import { Prisma, type Payment } from '@prisma/client';
import { formatMembershipNumber, formatRwf, type PaymentView } from '@dive/shared';
import { prisma } from '../../lib/prisma';
import { audit } from '../../lib/audit';
import { notify } from '../../lib/notify';
import { HttpError, notFound } from '../../lib/errors';
import { providerByName } from '../../payments';
import type { VerifiedPayment } from '../../payments/PaymentProvider';

const DAY = 24 * 60 * 60 * 1000;

interface MembershipMeta {
  packageId: string;
  durationDays: number;
  renewal: boolean;
  gymId: string;
}

/**
 * THE ONLY place a payment becomes PAID.
 * Called with a result fetched server-to-server from the provider (after a signed webhook,
 * or when the member's return page asks us to re-check). Safe to call any number of times.
 */
export async function applyVerified(payment: Payment, v: VerifiedPayment, source: 'webhook' | 'sync') {
  if (v.paymentId && v.paymentId !== payment.id) {
    console.warn(`Provider says ${v.providerRef} belongs to payment ${v.paymentId}, not ${payment.id}; ignoring`);
    return payment;
  }

  if (v.status === 'PAID') {
    // The provider must have collected exactly what we asked for, in RWF.
    if (v.amountRwf !== payment.amountRwf || (v.currency && v.currency.toLowerCase() !== 'rwf')) {
      await prisma.payment.updateMany({
        where: { id: payment.id, status: { not: 'PAID' } },
        data: { failureReason: `NEEDS_REVIEW: provider amount ${v.amountRwf} ${v.currency} ≠ expected ${payment.amountRwf} rwf` },
      });
      await audit({ action: 'payment.amount_mismatch', entity: 'payment', entityId: payment.id, after: v });
      return payment;
    }
    return markPaid(payment, source);
  }

  if (v.status === 'FAILED' || v.status === 'EXPIRED') {
    await prisma.payment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: { status: v.status === 'FAILED' ? 'FAILED' : 'CANCELLED', failureReason: v.status === 'FAILED' ? 'Payment was declined' : 'Checkout expired before payment' },
    });
  }
  return prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
}

async function markPaid(payment: Payment, source: 'webhook' | 'sync') {
  return prisma.$transaction(async (tx) => {
    // Conditional update = exactly-once fulfilment, even if the webhook and the return
    // page race, or the provider delivers the same event twice.
    // A CANCELLED/FAILED payment the provider later reports as paid is still recorded: money moved.
    const now = new Date();
    const won = await tx.payment.updateMany({
      where: { id: payment.id, status: { not: 'PAID' } },
      data: { status: 'PAID', paidAt: now, verifiedAt: now, failureReason: null },
    });
    if (won.count === 0) return tx.payment.findUniqueOrThrow({ where: { id: payment.id } });

    await audit({ actorId: payment.userId, actorRole: 'MEMBER', action: 'payment.paid', entity: 'payment', entityId: payment.id, after: { amountRwf: payment.amountRwf, provider: payment.provider, source } }, tx);

    if (payment.purpose === 'MEMBERSHIP') await fulfilMembership(tx, payment, now);
    else if (payment.purpose === 'COACH_PASS') await fulfilCoachPass(tx, payment, now);
    else if (payment.purpose === 'SESSION') await fulfilSession(tx, payment);
    else if (payment.purpose === 'GYM_SUBSCRIPTION') await fulfilSubscription(tx, payment, now);

    return tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
  });
}

const kgl = (d: Date, withTime = false) =>
  d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: withTime ? undefined : 'numeric', ...(withTime ? { weekday: 'short', hour: '2-digit', minute: '2-digit' } : {}), timeZone: 'Africa/Kigali' });

/** Coach Access Pass: a new period starts now, or right after the current pass if one is still running. */
async function fulfilCoachPass(tx: Prisma.TransactionClient, payment: Payment, now: Date) {
  const meta = payment.meta as unknown as { days: number };
  if (await tx.coachAccessPass.findUnique({ where: { id: payment.targetId } })) return;
  const current = await tx.coachAccessPass.findFirst({ where: { userId: payment.userId, endsAt: { gt: now } }, orderBy: { endsAt: 'desc' } });
  const startsAt = current ? current.endsAt : now;
  const endsAt = new Date(startsAt.getTime() + meta.days * DAY);
  await tx.coachAccessPass.create({ data: { id: payment.targetId, userId: payment.userId, paymentId: payment.id, priceRwf: payment.amountRwf, startsAt, endsAt } });
  await audit({ actorId: payment.userId, actorRole: 'MEMBER', action: 'coach_pass.activated', entity: 'coach_access_pass', entityId: payment.targetId, after: { endsAt } }, tx);
  await notify(payment.userId, { type: 'coach_pass.activated', title: 'Coach Access Pass active', body: `Full coach profiles, availability, messaging and booking until ${kgl(endsAt)}.`, link: '/coaches' }, tx);
}

/** Session fee paid: confirm the booking, unless the slot was given to someone else meanwhile. */
async function fulfilSession(tx: Prisma.TransactionClient, payment: Payment) {
  const b = await tx.booking.findUnique({ where: { id: payment.targetId }, include: { trainer: { select: { userId: true, user: { select: { fullName: true } } } }, member: { select: { fullName: true } } } });
  if (!b) return;
  if (b.status === 'CONFIRMED' || b.status === 'COMPLETED') return;
  const clash = await tx.booking.findFirst({ where: { trainerId: b.trainerId, startsAt: b.startsAt, id: { not: b.id }, status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] } } });
  if (b.status === 'CANCELLED' || clash) {
    await tx.payment.update({ where: { id: payment.id }, data: { failureReason: 'NEEDS_REVIEW: paid after the slot was released' } });
    await audit({ action: 'payment.needs_review', entity: 'payment', entityId: payment.id, after: { bookingId: b.id } }, tx);
    await notify(payment.userId, { type: 'booking.review', title: 'Payment received — slot no longer available', body: 'DIVE-IN support will refund or rebook you shortly.' }, tx);
    return;
  }
  await tx.booking.update({ where: { id: b.id }, data: { status: 'CONFIRMED', holdExpiresAt: null } });
  await audit({ actorId: payment.userId, actorRole: 'MEMBER', action: 'booking.confirmed', entity: 'booking', entityId: b.id }, tx);
  const when = kgl(b.startsAt, true);
  await notify(payment.userId, { type: 'booking.confirmed', title: `Session confirmed with ${b.trainer.user.fullName}`, body: `${when} · ${formatRwf(payment.amountRwf)} paid.`, link: '/app/coaching' }, tx);
  await notify(b.trainer.userId, { type: 'booking.new', title: `New session: ${b.member.fullName}`, body: when, link: '/trainer/sessions' }, tx);
}

/** Gym partner plan: extends from the end of the current subscription (or trial). */
async function fulfilSubscription(tx: Prisma.TransactionClient, payment: Payment, now: Date) {
  const meta = payment.meta as unknown as { gymId: string; plan: 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL'; months: number };
  if (await tx.gymSubscription.findFirst({ where: { paymentId: payment.id } })) return;
  const latest = await tx.gymSubscription.findFirst({ where: { gymId: meta.gymId, status: 'ACTIVE', endsAt: { gt: now } }, orderBy: { endsAt: 'desc' } });
  const startsAt = latest ? latest.endsAt : now;
  const endsAt = new Date(startsAt);
  endsAt.setUTCMonth(endsAt.getUTCMonth() + meta.months);
  await tx.gymSubscription.create({ data: { gymId: meta.gymId, plan: meta.plan, priceRwf: payment.amountRwf, startsAt, endsAt, paymentId: payment.id } });
  await audit({ actorId: payment.userId, actorRole: 'GYM_OWNER', action: 'subscription.paid', entity: 'gym', entityId: meta.gymId, gymId: meta.gymId, after: { plan: meta.plan, endsAt } }, tx);
  await notify(payment.userId, { type: 'subscription.paid', title: 'DIVE-IN partner plan renewed', body: `${meta.plan.toLowerCase()} plan active until ${kgl(endsAt)}.`, link: '/gym/subscription' }, tx);
}

/**
 * Admin refund: asks the provider to refund, then marks the payment REFUNDED and withdraws what it bought.
 * Desk payments (PAID_AT_GYM) aren't refundable here — the gym returns that money itself.
 */
export async function refundPayment(paymentId: string, reason: string | undefined, actor: { id: string; ip?: string | null }) {
  const p = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!p) throw notFound('Payment not found');
  if (p.status !== 'PAID') throw new HttpError(400, 'BAD_REQUEST', 'Only paid payments can be refunded');
  if (p.method === 'PAID_AT_GYM' || !p.providerRef) throw new HttpError(400, 'BAD_REQUEST', 'This payment was collected by the gym; it refunds the member directly');
  const provider = providerByName(p.provider);
  if (!provider) throw new HttpError(503, 'PAYMENTS_NOT_CONFIGURED', `The ${p.provider} provider is not configured on this server`);
  const refundId = await provider.refund(p.providerRef);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const won = await tx.payment.updateMany({ where: { id: p.id, status: 'PAID' }, data: { status: 'REFUNDED', failureReason: reason ? `Refunded: ${reason}` : 'Refunded' } });
    if (!won.count) return;
    if (p.purpose === 'MEMBERSHIP') await tx.membership.updateMany({ where: { id: p.targetId, status: { in: ['ACTIVE', 'AWAITING_PAYMENT'] } }, data: { status: 'CANCELLED', cancelledAt: now } });
    if (p.purpose === 'COACH_PASS') await tx.coachAccessPass.updateMany({ where: { id: p.targetId, endsAt: { gt: now } }, data: { endsAt: now } });
    if (p.purpose === 'SESSION') await tx.booking.updateMany({ where: { id: p.targetId, status: { in: ['CONFIRMED', 'PENDING_PAYMENT'] } }, data: { status: 'CANCELLED', cancelledAt: now, cancelReason: reason ?? 'Refunded', cancelledById: actor.id } });
    if (p.purpose === 'GYM_SUBSCRIPTION') await tx.gymSubscription.updateMany({ where: { paymentId: p.id }, data: { status: 'CANCELLED' } });
    await audit({ actorId: actor.id, actorRole: 'ADMIN', ip: actor.ip ?? null, action: 'payment.refunded', entity: 'payment', entityId: p.id, after: { refundId, reason, amountRwf: p.amountRwf, purpose: p.purpose } }, tx);
    await notify(p.userId, { type: 'payment.refunded', title: `Refund of ${formatRwf(p.amountRwf)} issued`, body: reason ?? 'It can take a few days to reach your account.' }, tx);
  });
  return prisma.payment.findUniqueOrThrow({ where: { id: p.id } });
}

async function fulfilMembership(tx: Prisma.TransactionClient, payment: Payment, now: Date) {
  const meta = payment.meta as unknown as MembershipMeta;
  const m = await tx.membership.findUnique({ where: { id: payment.targetId }, include: { gym: { select: { name: true } } } });
  if (!m) return;

  let live = m.status === 'AWAITING_PAYMENT' || m.status === 'ACTIVE';
  if (m.status === 'EXPIRED') {
    // Renewal paid just after the old period lapsed: reactivate, unless another live membership exists.
    const other = await tx.membership.findFirst({ where: { memberId: m.memberId, gymId: m.gymId, id: { not: m.id }, status: { in: ['AWAITING_PAYMENT', 'ACTIVE'] } } });
    live = !other;
  }
  if (!live) {
    // Paid after the member cancelled. Keep the money on record and flag for an admin refund/reactivation.
    await tx.payment.update({ where: { id: payment.id }, data: { failureReason: 'NEEDS_REVIEW: paid after membership was cancelled' } });
    await audit({ action: 'payment.needs_review', entity: 'payment', entityId: payment.id, gymId: m.gymId }, tx);
    return;
  }

  const stillActive = m.status === 'ACTIVE' && m.endsAt && m.endsAt > now;
  const startsAt = stillActive ? m.startsAt! : now;
  const base = stillActive ? m.endsAt! : now;
  const endsAt = new Date(base.getTime() + meta.durationDays * DAY);

  await tx.membership.update({
    where: { id: m.id },
    data: { status: 'ACTIVE', packageId: meta.packageId, priceRwf: payment.amountRwf, startsAt, endsAt, activatedAt: stillActive ? m.activatedAt : now },
  });
  await audit(
    { actorId: payment.userId, actorRole: 'MEMBER', action: stillActive ? 'membership.renewed' : 'membership.activated', entity: 'membership', entityId: m.id, gymId: m.gymId, after: { endsAt } },
    tx,
  );
  const until = endsAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Kigali' });
  await notify(
    payment.userId,
    {
      type: stillActive ? 'membership.renewed' : 'membership.activated',
      title: stillActive ? `${m.gym.name} membership renewed` : `Your ${m.gym.name} card is active`,
      body: `Membership ${formatMembershipNumber(m.number)} · valid until ${until}. Payment of ${formatRwf(payment.amountRwf)} verified.`,
      link: `/app/cards/${m.id}`,
    },
    tx,
  );
}

/** Asks the provider directly for the latest status of a pending payment. */
export async function syncPayment(payment: Payment) {
  if (payment.status !== 'PENDING' || !payment.providerRef) return payment;
  const provider = providerByName(payment.provider);
  if (!provider) return payment;
  try {
    const v = await provider.verify(payment.providerRef);
    return applyVerified(payment, v, 'sync');
  } catch (e) {
    console.error('verify failed', e);
    return payment;
  }
}

/** Signed webhook from a provider. Returns a short status for logging. */
export async function handleWebhook(providerName: string, rawBody: Buffer, headers: Record<string, string | string[] | undefined>) {
  const provider = providerByName(providerName);
  if (!provider) return 'provider-not-configured';
  const event = provider.parseWebhook(rawBody, headers); // throws WebhookSignatureError

  // Record every event once; a redelivery hits the unique key and stops here.
  try {
    await prisma.paymentEvent.create({
      data: { provider: provider.name, eventId: event.eventId, type: event.type, payload: event.payload as Prisma.InputJsonValue },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return 'duplicate';
    throw e;
  }
  if (!event.providerRef) return 'ignored';

  const payment = await prisma.payment.findFirst({
    where: { provider: provider.name, OR: [{ providerRef: event.providerRef }, ...(event.paymentId ? [{ id: event.paymentId }] : [])] },
  });
  if (!payment) return 'unknown-payment';
  if (payment.providerRef && payment.providerRef !== event.providerRef) return 'ref-mismatch';

  // Don't trust the event body for the outcome: ask the provider.
  const verified = await provider.verify(event.providerRef);
  const after = await applyVerified(payment, verified, 'webhook');
  await prisma.paymentEvent.update({
    where: { provider_eventId: { provider: provider.name, eventId: event.eventId } },
    data: { processed: true, paymentId: payment.id },
  });
  return after.status;
}

// ───────────────────────── read models ─────────────────────────

export async function describe(payments: Payment[]) {
  const ids = (purpose: string) => payments.filter((p) => p.purpose === purpose).map((p) => p.targetId);
  const [memberships, bookings, gyms] = await Promise.all([
    prisma.membership.findMany({ where: { id: { in: ids('MEMBERSHIP') } }, select: { id: true, gym: { select: { name: true } }, package: { select: { name: true } } } }),
    prisma.booking.findMany({ where: { id: { in: ids('SESSION') } }, select: { id: true, startsAt: true, trainer: { select: { user: { select: { fullName: true } } } } } }),
    prisma.gym.findMany({ where: { id: { in: payments.filter((p) => p.purpose === 'GYM_SUBSCRIPTION').map((p) => (p.meta as { gymId?: string } | null)?.gymId ?? '').filter(Boolean) } }, select: { id: true, name: true } }),
  ]);
  const byId = new Map(memberships.map((m) => [m.id, m]));
  const bookingById = new Map(bookings.map((b) => [b.id, b]));
  const gymById = new Map(gyms.map((g) => [g.id, g.name]));
  return (p: Payment): PaymentView => {
    const m = byId.get(p.targetId);
    const meta = (p.meta ?? {}) as Partial<MembershipMeta> & { plan?: string; gymId?: string };
    const b = bookingById.get(p.targetId);
    const description =
      p.purpose === 'MEMBERSHIP' && m
        ? `${m.gym.name} · ${m.package.name}${meta.renewal ? ' (renewal)' : ''}`
        : p.purpose === 'COACH_PASS'
          ? 'Coach Access Pass'
          : p.purpose === 'SESSION' && b
            ? `Session with ${b.trainer.user.fullName} · ${kgl(b.startsAt, true)}`
            : p.purpose === 'GYM_SUBSCRIPTION'
              ? `DIVE-IN partner plan · ${(meta.plan ?? '').toLowerCase()}${meta.gymId && gymById.get(meta.gymId) ? ` · ${gymById.get(meta.gymId)}` : ''}`
              : p.purpose;
    const open = p.status === 'PENDING' && p.checkoutUrl && (!p.expiresAt || p.expiresAt > new Date());
    return {
      id: p.id,
      purpose: p.purpose,
      status: p.status,
      amountRwf: p.amountRwf,
      method: p.method,
      provider: p.provider,
      description,
      createdAt: p.createdAt.toISOString(),
      paidAt: p.paidAt?.toISOString() ?? null,
      failureReason: p.failureReason?.startsWith('NEEDS_REVIEW') ? 'Under review by DIVE-IN support' : p.failureReason,
      checkoutUrl: open ? p.checkoutUrl : null,
      membershipId: p.purpose === 'MEMBERSHIP' ? p.targetId : null,
    };
  };
}

export async function listMyPayments(userId: string) {
  const rows = await prisma.payment.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100 });
  const view = await describe(rows);
  return rows.map(view);
}

/** Caller's own payment (any role); pending ones are re-checked with the provider first. */
export async function getMyPayment(userId: string, id: string) {
  let p = await prisma.payment.findFirst({ where: { id, userId } });
  if (!p) throw notFound('Payment not found');
  p = await syncPayment(p);
  return (await describe([p]))(p);
}
