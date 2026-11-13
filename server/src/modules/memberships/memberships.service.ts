import { Prisma, type Membership } from '@prisma/client';
import { CONFIG_KEYS, formatMembershipNumber, formatRwf, type CheckoutStarted, type MembershipStatus, type MyMembership } from '@dive/shared';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { audit } from '../../lib/audit';
import { notify } from '../../lib/notify';
import { getConfig } from '../../lib/platformConfig';
import { HttpError, badRequest, conflict, notFound } from '../../lib/errors';
import { getProvider, providerByName } from '../../payments';
import { awaitCheckoutLink } from '../../lib/onlinePayment';

/** ACTIVE memberships past their end date are reported (and stored, by the sweeper) as EXPIRED. */
export function effectiveStatus(m: Pick<Membership, 'status' | 'endsAt'>): MembershipStatus {
  if (m.status === 'ACTIVE' && m.endsAt && m.endsAt < new Date()) return 'EXPIRED';
  return m.status;
}

const membershipInclude = {
  gym: { select: { id: true, slug: true, name: true, neighbourhood: true, diveCheckoutEnabled: true } },
  package: { select: { id: true, name: true, durationDays: true } },
} satisfies Prisma.MembershipInclude;

type MembershipRow = Prisma.MembershipGetPayload<{ include: typeof membershipInclude }>;

export async function toMyMembership(m: MembershipRow): Promise<MyMembership> {
  const last = await prisma.payment.findFirst({
    where: { purpose: 'MEMBERSHIP', targetId: m.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true, checkoutUrl: true, expiresAt: true },
  });
  const usable = last?.status === 'PENDING' && last.checkoutUrl && (!last.expiresAt || last.expiresAt > new Date());
  return {
    id: m.id,
    number: formatMembershipNumber(m.number),
    status: effectiveStatus(m),
    gym: m.gym,
    package: m.package,
    priceRwf: m.priceRwf,
    startsAt: m.startsAt?.toISOString() ?? null,
    endsAt: m.endsAt?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
    lastPayment: last ? { id: last.id, status: last.status, checkoutUrl: usable ? last.checkoutUrl : null } : null,
  };
}

export async function listMine(memberId: string) {
  const rows = await prisma.membership.findMany({
    where: { memberId, status: { not: 'CANCELLED' } },
    include: membershipInclude,
    orderBy: [{ updatedAt: 'desc' }],
  });
  return Promise.all(rows.map(toMyMembership));
}

export async function getMine(memberId: string, id: string) {
  const m = await prisma.membership.findFirst({ where: { id, memberId }, include: membershipInclude });
  if (!m) throw notFound('Membership not found');
  return toMyMembership(m);
}

/** Loads a purchasable package; the gym must be approved and the package active. */
async function loadPackage(packageId: string) {
  const pkg = await prisma.package.findUnique({ where: { id: packageId }, include: { gym: true } });
  if (!pkg || !pkg.active || pkg.gym.status !== 'APPROVED') throw notFound('This package is not available');
  return pkg;
}

/** Cancels earlier unpaid checkouts for a membership so only one can ever be paid. */
export async function cancelOpenPayments(membershipId: string, reason: string) {
  const open = await prisma.payment.findMany({ where: { purpose: 'MEMBERSHIP', targetId: membershipId, status: 'PENDING' } });
  for (const p of open) {
    if (p.providerRef) await providerByName(p.provider)?.cancel(p.providerRef);
    await prisma.payment.updateMany({ where: { id: p.id, status: 'PENDING' }, data: { status: 'CANCELLED', failureReason: reason } });
  }
}

/**
 * Starts (or resumes) online payment for a package.
 * - Same Idempotency-Key → same payment and the same checkout link; nothing new is created.
 * - No live membership at this gym → a new AWAITING_PAYMENT membership.
 * - AWAITING_PAYMENT one exists → reused (switched to this package); older open checkouts are cancelled.
 * - ACTIVE one exists → this is a renewal; paying extends it.
 */
export async function startCheckout(member: { id: string; email: string }, packageId: string, idempotencyKey: string): Promise<CheckoutStarted> {
  const replay = await prisma.payment.findUnique({ where: { userId_idempotencyKey: { userId: member.id, idempotencyKey } } });
  if (replay) return replayCheckout(replay, packageId);

  const pkg = await loadPackage(packageId);
  if (!pkg.gym.diveCheckoutEnabled) {
    throw badRequest(`${pkg.gym.name} takes payment at the front desk. Request the membership instead and pay at reception.`);
  }
  const provider = getProvider(); // fails fast (503) if payments aren't configured

  const commissionPct = pkg.gym.commissionOptIn ? (await getConfig(CONFIG_KEYS.commission)).percent : 0;
  const commissionRwf = Math.round((pkg.priceRwf * commissionPct) / 100);

  const live = await prisma.membership.findFirst({
    where: { memberId: member.id, gymId: pkg.gymId, status: { in: ['AWAITING_PAYMENT', 'ACTIVE'] } },
  });
  const renewal = !!live && effectiveStatus(live) === 'ACTIVE';
  if (live && !renewal) await cancelOpenPayments(live.id, 'Replaced by a newer checkout');

  let payment;
  let membershipId: string;
  try {
    ({ payment, membershipId } = await prisma.$transaction(async (tx) => {
      let membership: Membership;
      if (!live) {
        membership = await tx.membership.create({ data: { memberId: member.id, gymId: pkg.gymId, packageId: pkg.id, priceRwf: pkg.priceRwf } });
      } else if (renewal) {
        membership = live;
      } else if (live.status === 'ACTIVE') {
        // ACTIVE but past its end date: the sweeper hasn't run yet. Treat as a fresh start.
        membership = await tx.membership.update({ where: { id: live.id }, data: { status: 'AWAITING_PAYMENT', packageId: pkg.id, priceRwf: pkg.priceRwf } });
      } else {
        membership = await tx.membership.update({ where: { id: live.id }, data: { packageId: pkg.id, priceRwf: pkg.priceRwf } });
      }
      const payment = await tx.payment.create({
        data: {
          userId: member.id,
          purpose: 'MEMBERSHIP',
          targetId: membership.id,
          amountRwf: pkg.priceRwf,
          commissionRwf,
          payeeShareRwf: pkg.priceRwf - commissionRwf,
          method: provider.method,
          provider: provider.name,
          idempotencyKey,
          meta: { packageId: pkg.id, durationDays: pkg.durationDays, renewal, gymId: pkg.gymId },
        },
      });
      return { payment, membershipId: membership.id };
    }));
  } catch (e) {
    // Same key sent twice at the same moment: the other request won; return its result.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const winner = await prisma.payment.findUnique({ where: { userId_idempotencyKey: { userId: member.id, idempotencyKey } } });
      if (winner) return replayCheckout(winner, packageId);
      throw conflict('You already have a membership in progress at this gym. Refresh and try again.');
    }
    throw e;
  }

  try {
    const checkout = await provider.createCheckout({
      paymentId: payment.id,
      amountRwf: payment.amountRwf,
      description: `${pkg.gym.name} · ${pkg.name}${renewal ? ' (renewal)' : ''}`,
      customerEmail: member.email,
      successUrl: `${env.CLIENT_URL}/app/checkout/return?payment=${payment.id}`,
      cancelUrl: `${env.CLIENT_URL}/app/checkout/return?payment=${payment.id}&cancelled=1`,
      idempotencyKey: `dive-checkout-${payment.id}`,
    });
    await prisma.payment.update({
      where: { id: payment.id },
      data: { providerRef: checkout.providerRef, checkoutUrl: checkout.redirectUrl, expiresAt: checkout.expiresAt },
    });
    await audit({ actorId: member.id, actorRole: 'MEMBER', action: 'payment.checkout_started', entity: 'payment', entityId: payment.id, gymId: pkg.gymId, after: { amountRwf: payment.amountRwf, renewal } });
    return { paymentId: payment.id, membershipId, redirectUrl: checkout.redirectUrl };
  } catch (e) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED', failureReason: `Could not open checkout: ${(e as Error).message}`.slice(0, 300) } });
    if (e instanceof HttpError) throw e;
    console.error('createCheckout failed', e);
    throw new HttpError(502, 'PROVIDER_ERROR', 'The payment provider could not start checkout. Please try again.');
  }
}

async function replayCheckout(found: { id: string; targetId: string; status: string; checkoutUrl: string | null; meta: Prisma.JsonValue; expiresAt: Date | null }, packageId: string): Promise<CheckoutStarted> {
  const p = await awaitCheckoutLink(found, () => prisma.payment.findUnique({ where: { id: found.id } }));
  const meta = (p.meta ?? {}) as { packageId?: string };
  if (meta.packageId !== packageId) throw conflict('This Idempotency-Key was already used for a different purchase');
  if (p.status === 'PAID') return { paymentId: p.id, membershipId: p.targetId, redirectUrl: `${env.CLIENT_URL}/app/checkout/return?payment=${p.id}` };
  if (p.status !== 'PENDING' || !p.checkoutUrl || (p.expiresAt && p.expiresAt < new Date())) {
    throw conflict('That checkout is no longer open. Start a new one.');
  }
  return { paymentId: p.id, membershipId: p.targetId, redirectUrl: p.checkoutUrl };
}

/** Pay-at-gym: create an AWAITING_PAYMENT membership the gym will mark paid at reception (Phase 4). */
export async function requestAtGym(memberId: string, packageId: string) {
  const pkg = await loadPackage(packageId);
  const live = await prisma.membership.findFirst({ where: { memberId, gymId: pkg.gymId, status: { in: ['AWAITING_PAYMENT', 'ACTIVE'] } } });
  if (live && effectiveStatus(live) === 'ACTIVE') throw conflict('Your membership here is already active. Renew it at the front desk.');

  try {
    const m = await prisma.$transaction(async (tx) => {
      const m = live
        ? await tx.membership.update({ where: { id: live.id }, data: { status: 'AWAITING_PAYMENT', packageId: pkg.id, priceRwf: pkg.priceRwf } })
        : await tx.membership.create({ data: { memberId, gymId: pkg.gymId, packageId: pkg.id, priceRwf: pkg.priceRwf } });
      await notify(memberId, {
        type: 'membership.requested',
        title: `Pay at ${pkg.gym.name} reception to activate`,
        body: `${pkg.name} · ${formatRwf(pkg.priceRwf)}. Show your membership number at the front desk.`,
        link: `/app/cards/${m.id}`,
      }, tx);
      await notify(pkg.gym.ownerId, { type: 'gym.member_requested', title: 'New membership request', body: `${pkg.name} · ${formatRwf(pkg.priceRwf)}`, link: '/gym' }, tx);
      await audit({ actorId: memberId, actorRole: 'MEMBER', action: 'membership.requested_at_gym', entity: 'membership', entityId: m.id, gymId: pkg.gymId }, tx);
      return m;
    });
    return getMine(memberId, m.id);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw conflict('You already have a membership in progress at this gym');
    throw e;
  }
}

/** A member can withdraw a membership that hasn't been paid yet. */
export async function cancelUnpaid(memberId: string, id: string) {
  const m = await prisma.membership.findFirst({ where: { id, memberId } });
  if (!m) throw notFound('Membership not found');
  if (m.status !== 'AWAITING_PAYMENT') throw badRequest('Only memberships awaiting payment can be cancelled');
  await cancelOpenPayments(m.id, 'Membership cancelled by member');
  await prisma.membership.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
  await audit({ actorId: memberId, actorRole: 'MEMBER', action: 'membership.cancelled', entity: 'membership', entityId: id, gymId: m.gymId });
}
