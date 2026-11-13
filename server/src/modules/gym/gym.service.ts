import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Prisma, type Role } from '@prisma/client';
import {
  formatMembershipNumber,
  formatRwf,
  type GymContext,
  type GymMemberRow,
  type GymOverview,
  type GymPackageRow,
  type LinkedTrainerRow,
  type StaffRow,
} from '@dive/shared';
import type { z } from 'zod';
import type { gymProfileSchema, packageSchema, staffCreateSchema } from '@dive/shared';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { audit } from '../../lib/audit';
import { notify } from '../../lib/notify';
import { badRequest, conflict, notFound } from '../../lib/errors';
import { DAY_MS, kigaliDayStart, kigaliMonthStart } from '../../lib/time';
import { cancelOpenPayments, effectiveStatus } from '../memberships/memberships.service';
import { lastCheckIns, recentCheckIns, verifiedMembershipIds } from './reception.service';

export interface Actor {
  id: string;
  role: Role;
  ip?: string | null;
}
const who = (a: Actor) => ({ actorId: a.id, actorRole: a.role, ip: a.ip ?? null });

// ───────────────────────── context & overview ─────────────────────────

export async function context(gymId: string, as: 'OWNER' | 'RECEPTIONIST'): Promise<GymContext> {
  const g = await prisma.gym.findUniqueOrThrow({
    where: { id: gymId },
    include: { subscriptions: { where: { status: 'ACTIVE' }, orderBy: { endsAt: 'desc' }, take: 1 } },
  });
  const s = g.subscriptions[0];
  return {
    id: g.id,
    name: g.name,
    slug: g.slug,
    status: g.status,
    statusNote: g.statusNote,
    as,
    subscription: s ? { plan: s.plan, endsAt: s.endsAt.toISOString(), daysLeft: Math.ceil((s.endsAt.getTime() - Date.now()) / DAY_MS) } : null,
  };
}

export async function ownedGyms(ownerId: string) {
  return prisma.gym.findMany({ where: { ownerId }, select: { id: true, name: true, status: true }, orderBy: { createdAt: 'asc' } });
}

/** Membership payments of this gym (payments reference memberships by targetId). */
function gymPaymentsWhere(gymId: string, extra: Prisma.Sql = Prisma.empty) {
  return Prisma.sql`FROM payments p JOIN memberships m ON m.id = p.target_id WHERE p.purpose = 'MEMBERSHIP' AND m.gym_id = ${gymId}::uuid ${extra}`;
}

export async function overview(gymId: string, as: 'OWNER' | 'RECEPTIONIST'): Promise<GymOverview> {
  const now = new Date();
  const [activeMembers, awaitingPayment, expiringSoon, checkInsToday, recent] = await Promise.all([
    prisma.membership.count({ where: { gymId, status: 'ACTIVE', endsAt: { gt: now } } }),
    prisma.membership.count({ where: { gymId, status: 'AWAITING_PAYMENT' } }),
    prisma.membership.count({ where: { gymId, status: 'ACTIVE', endsAt: { gt: now, lt: new Date(now.getTime() + 7 * DAY_MS) } } }),
    prisma.checkIn.count({ where: { gymId, result: 'ALLOWED', createdAt: { gte: kigaliDayStart() } } }),
    recentCheckIns(gymId, undefined, 8),
  ]);
  const out: GymOverview = { activeMembers, awaitingPayment, expiringSoon, checkInsToday, recentCheckIns: recent, pendingRequests: [] };
  if (as === 'OWNER') {
    const [{ total }] = await prisma.$queryRaw<{ total: bigint | null }[]>`SELECT SUM(p.payee_share_rwf) AS total ${gymPaymentsWhere(gymId, Prisma.sql`AND p.status = 'PAID' AND p.paid_at >= ${kigaliMonthStart()}`)}`;
    out.revenueThisMonthRwf = Number(total ?? 0);
    out.pendingRequests = (await listMembers(gymId, { status: 'AWAITING_PAYMENT', page: 1 }, true)).rows.slice(0, 6);
  }
  return out;
}

// ───────────────────────── profile ─────────────────────────

export async function getProfile(gymId: string) {
  const g = await prisma.gym.findUniqueOrThrow({ where: { id: gymId } });
  return {
    id: g.id,
    slug: g.slug,
    name: g.name,
    description: g.description,
    neighbourhood: g.neighbourhood,
    address: g.address,
    phone: g.phone,
    email: g.email,
    lat: Number(g.lat ?? -1.9441),
    lng: Number(g.lng ?? 30.0619),
    openingHours: (g.openingHours as Record<string, string> | null) ?? {},
    tags: g.tags,
    amenities: g.amenities,
    diveCheckoutEnabled: g.diveCheckoutEnabled,
    commissionOptIn: g.commissionOptIn,
    status: g.status,
  };
}

export async function updateProfile(gymId: string, input: z.output<typeof gymProfileSchema>, actor: Actor) {
  const before = await getProfile(gymId);
  const data = { ...input, commissionOptIn: input.diveCheckoutEnabled && input.commissionOptIn };
  await prisma.gym.update({ where: { id: gymId }, data });
  const changed = Object.fromEntries(
    Object.entries(data).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify((before as Record<string, unknown>)[k])),
  );
  if (Object.keys(changed).length) {
    const beforeChanged = Object.fromEntries(Object.keys(changed).map((k) => [k, (before as Record<string, unknown>)[k]]));
    await audit({ ...who(actor), action: 'gym.profile_updated', entity: 'gym', entityId: gymId, gymId, before: beforeChanged, after: changed });
  }
  return getProfile(gymId);
}

// ───────────────────────── packages ─────────────────────────

export async function listPackages(gymId: string): Promise<GymPackageRow[]> {
  const [pkgs, counts] = await Promise.all([
    prisma.package.findMany({ where: { gymId }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
    prisma.membership.groupBy({ by: ['packageId'], where: { gymId, status: 'ACTIVE', endsAt: { gt: new Date() } }, _count: true }),
  ]);
  const byPkg = new Map(counts.map((c) => [c.packageId, c._count]));
  return pkgs.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    durationDays: p.durationDays,
    priceRwf: p.priceRwf,
    perks: p.perks,
    active: p.active,
    sortOrder: p.sortOrder,
    activeMembers: byPkg.get(p.id) ?? 0,
  }));
}

export async function createPackage(gymId: string, input: z.output<typeof packageSchema>, actor: Actor) {
  const max = await prisma.package.aggregate({ where: { gymId }, _max: { sortOrder: true } });
  const p = await prisma.package.create({ data: { ...input, gymId, sortOrder: (max._max.sortOrder ?? -1) + 1 } });
  await audit({ ...who(actor), action: 'package.created', entity: 'package', entityId: p.id, gymId, after: { name: p.name, priceRwf: p.priceRwf, durationDays: p.durationDays } });
  return p;
}

export async function updatePackage(gymId: string, id: string, input: z.output<typeof packageSchema>, actor: Actor) {
  const before = await prisma.package.findFirst({ where: { id, gymId } });
  if (!before) throw notFound('Package not found');
  const p = await prisma.package.update({ where: { id }, data: input });
  // Existing members keep the price they paid; only new purchases use the new price.
  const priceChanged = before.priceRwf !== p.priceRwf || before.durationDays !== p.durationDays;
  await audit({
    ...who(actor),
    action: priceChanged ? 'package.price_changed' : 'package.updated',
    entity: 'package',
    entityId: id,
    gymId,
    before: { name: before.name, priceRwf: before.priceRwf, durationDays: before.durationDays, active: before.active },
    after: { name: p.name, priceRwf: p.priceRwf, durationDays: p.durationDays, active: p.active },
  });
  return p;
}

/** Deletes a package nobody has ever bought; otherwise it can only be deactivated. */
export async function deletePackage(gymId: string, id: string, actor: Actor) {
  const p = await prisma.package.findFirst({ where: { id, gymId } });
  if (!p) throw notFound('Package not found');
  if (await prisma.membership.count({ where: { packageId: id } })) throw conflict('Members have bought this package. Deactivate it instead so their records stay intact.');
  await prisma.package.delete({ where: { id } });
  await audit({ ...who(actor), action: 'package.deleted', entity: 'package', entityId: id, gymId, before: { name: p.name, priceRwf: p.priceRwf } });
}

export async function reorderPackages(gymId: string, ids: string[]) {
  const owned = await prisma.package.count({ where: { gymId, id: { in: ids } } });
  if (owned !== ids.length) throw badRequest('Unknown package in list');
  await prisma.$transaction(ids.map((id, i) => prisma.package.update({ where: { id }, data: { sortOrder: i } })));
}

// ───────────────────────── members ─────────────────────────

const PAGE = 25;

export async function listMembers(gymId: string, q: { q?: string; status?: string; page: number }, owner: boolean) {
  const now = new Date();
  const where: Prisma.MembershipWhereInput = { gymId };
  switch (q.status) {
    case 'ACTIVE': Object.assign(where, { status: 'ACTIVE', endsAt: { gt: now } }); break;
    case 'EXPIRING': Object.assign(where, { status: 'ACTIVE', endsAt: { gt: now, lt: new Date(now.getTime() + 7 * DAY_MS) } }); break;
    case 'EXPIRED': Object.assign(where, { OR: [{ status: 'EXPIRED' }, { status: 'ACTIVE', endsAt: { lte: now } }] }); break;
    case 'AWAITING_PAYMENT': Object.assign(where, { status: 'AWAITING_PAYMENT' }); break;
    case 'CANCELLED': Object.assign(where, { status: 'CANCELLED' }); break;
    default: Object.assign(where, { status: { not: 'CANCELLED' } });
  }
  if (q.q) {
    const digits = q.q.toUpperCase().replace(/^DV/, '').replace(/[\s-]/g, '');
    const or: Prisma.MembershipWhereInput[] = [
      { member: { fullName: { contains: q.q, mode: 'insensitive' } } },
      { member: { email: { contains: q.q.toLowerCase() } } },
      { member: { phone: { contains: q.q.replace(/\s/g, '') } } },
    ];
    if (/^\d{1,8}$/.test(digits)) or.push({ number: Number(digits) });
    where.AND = [{ OR: or }];
  }
  const [total, rows] = await Promise.all([
    prisma.membership.count({ where }),
    prisma.membership.findMany({
      where,
      include: { member: { select: { fullName: true, email: true, phone: true } }, package: { select: { name: true } } },
      orderBy: [{ updatedAt: 'desc' }],
      skip: (q.page - 1) * PAGE,
      take: PAGE,
    }),
  ]);
  const ids = rows.map((r) => r.id);
  const [verified, last] = await Promise.all([verifiedMembershipIds(ids), lastCheckIns(ids)]);
  const out: GymMemberRow[] = rows.map((m) => ({
    membershipId: m.id,
    number: formatMembershipNumber(m.number),
    memberName: m.member.fullName,
    ...(owner ? { email: m.member.email, phone: m.member.phone } : {}),
    packageName: m.package.name,
    packageId: m.packageId,
    status: effectiveStatus(m),
    priceRwf: m.priceRwf,
    startsAt: m.startsAt?.toISOString() ?? null,
    endsAt: m.endsAt?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
    paymentVerified: verified.has(m.id),
    lastCheckInAt: last.get(m.id)?.toISOString() ?? null,
  }));
  return { rows: out, total, page: q.page, pageSize: PAGE };
}

export async function memberDetail(gymId: string, membershipId: string) {
  const m = await prisma.membership.findFirst({ where: { id: membershipId, gymId }, select: { id: true } });
  if (!m) throw notFound('Membership not found');
  const [rows, payments, checkIns] = await Promise.all([
    listMembersById(gymId, membershipId),
    prisma.payment.findMany({ where: { purpose: 'MEMBERSHIP', targetId: membershipId }, orderBy: { createdAt: 'desc' }, take: 20 }),
    recentCheckInsFor(membershipId),
  ]);
  return {
    member: rows[0],
    payments: payments.map((p) => ({
      id: p.id,
      status: p.status,
      method: p.method,
      amountRwf: p.amountRwf,
      gymShareRwf: p.payeeShareRwf,
      commissionRwf: p.commissionRwf,
      paidAt: p.paidAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
    })),
    checkIns,
  };
}

async function listMembersById(gymId: string, id: string): Promise<GymMemberRow[]> {
  const m = await prisma.membership.findFirstOrThrow({
    where: { id, gymId },
    include: { member: { select: { fullName: true, email: true, phone: true } }, package: { select: { name: true } } },
  });
  const [verified, last] = await Promise.all([verifiedMembershipIds([id]), lastCheckIns([id])]);
  return [
    {
      membershipId: m.id,
      number: formatMembershipNumber(m.number),
      memberName: m.member.fullName,
      email: m.member.email,
      phone: m.member.phone,
      packageName: m.package.name,
      packageId: m.packageId,
      status: effectiveStatus(m),
      priceRwf: m.priceRwf,
      startsAt: m.startsAt?.toISOString() ?? null,
      endsAt: m.endsAt?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
      paymentVerified: verified.has(id),
      lastCheckInAt: last.get(id)?.toISOString() ?? null,
    },
  ];
}

async function recentCheckInsFor(membershipId: string) {
  const rows = await prisma.checkIn.findMany({ where: { membershipId }, orderBy: { createdAt: 'desc' }, take: 15, include: { staff: { select: { fullName: true } } } });
  return rows.map((c) => ({ id: c.id, result: c.result, reason: c.reason, staffName: c.staff.fullName, createdAt: c.createdAt.toISOString() }));
}

/**
 * The owner records money collected at the front desk (pay-at-gym gyms, or a desk renewal).
 * AWAITING_PAYMENT → ACTIVE from today; ACTIVE → extended from its end date; EXPIRED → restarted.
 * Idempotency-Key makes a double click record one payment, not two.
 */
export async function recordGymPayment(gymId: string, membershipId: string, packageId: string, idempotencyKey: string, note: string | undefined, actor: Actor) {
  const m = await prisma.membership.findFirst({ where: { id: membershipId, gymId }, include: { gym: { select: { name: true } } } });
  if (!m) throw notFound('Membership not found');
  const pkg = await prisma.package.findFirst({ where: { id: packageId, gymId } });
  if (!pkg) throw notFound('Package not found');
  if (m.status === 'CANCELLED') throw badRequest('This membership was cancelled. Ask the member to request a new one.');

  const replay = await prisma.payment.findUnique({ where: { userId_idempotencyKey: { userId: m.memberId, idempotencyKey } } });
  if (replay) return { paymentId: replay.id, duplicate: true };

  try {
    return await prisma.$transaction(async (tx) => {
      // Lock the membership row so two desks can't extend it at the same time.
      await tx.$queryRaw`SELECT id FROM memberships WHERE id = ${m.id}::uuid FOR UPDATE`;
      const cur = await tx.membership.findUniqueOrThrow({ where: { id: m.id } });
      if (cur.status === 'CANCELLED') throw badRequest('This membership was cancelled');
      if (cur.status === 'EXPIRED' || (cur.status === 'ACTIVE' && cur.endsAt && cur.endsAt <= new Date())) {
        const other = await tx.membership.findFirst({ where: { memberId: cur.memberId, gymId, id: { not: cur.id }, status: { in: ['AWAITING_PAYMENT', 'ACTIVE'] } } });
        if (other) throw conflict('This member already has another live membership here. Record the payment on that one.');
      }
      const now = new Date();
      const stillActive = cur.status === 'ACTIVE' && cur.endsAt && cur.endsAt > now;
      const endsAt = new Date((stillActive ? cur.endsAt!.getTime() : now.getTime()) + pkg.durationDays * DAY_MS);

      const payment = await tx.payment.create({
        data: {
          userId: cur.memberId,
          purpose: 'MEMBERSHIP',
          targetId: cur.id,
          amountRwf: pkg.priceRwf,
          commissionRwf: 0, // collected by the gym, not processed by DIVE-IN
          payeeShareRwf: pkg.priceRwf,
          method: 'PAID_AT_GYM',
          provider: 'gym',
          status: 'PAID',
          idempotencyKey,
          paidAt: now,
          verifiedAt: now,
          recordedById: actor.id,
          meta: { packageId: pkg.id, durationDays: pkg.durationDays, renewal: !!stillActive, gymId, note: note ?? null },
        },
      });
      await tx.membership.update({
        where: { id: cur.id },
        data: { status: 'ACTIVE', packageId: pkg.id, priceRwf: pkg.priceRwf, startsAt: stillActive ? cur.startsAt : now, endsAt, activatedAt: stillActive ? cur.activatedAt : now },
      });
      await cancelOpenPaymentsTx(tx, cur.id);
      await audit({ ...who(actor), action: 'payment.recorded_at_gym', entity: 'membership', entityId: cur.id, gymId, after: { paymentId: payment.id, amountRwf: pkg.priceRwf, package: pkg.name, endsAt, note } }, tx);
      const until = endsAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Kigali' });
      await notify(cur.memberId, {
        type: stillActive ? 'membership.renewed' : 'membership.activated',
        title: stillActive ? `${m.gym.name} membership renewed` : `Your ${m.gym.name} card is active`,
        body: `${pkg.name} · ${formatRwf(pkg.priceRwf)} paid at the front desk. Valid until ${until}.`,
        link: `/app/cards/${cur.id}`,
      }, tx);
      return { paymentId: payment.id, duplicate: false };
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const winner = await prisma.payment.findUnique({ where: { userId_idempotencyKey: { userId: m.memberId, idempotencyKey } } });
      if (winner) return { paymentId: winner.id, duplicate: true };
    }
    throw e;
  }
}

/** Online checkouts left open for a membership just paid at the desk can't be paid any more. */
async function cancelOpenPaymentsTx(tx: Prisma.TransactionClient, membershipId: string) {
  await tx.payment.updateMany({ where: { purpose: 'MEMBERSHIP', targetId: membershipId, status: 'PENDING' }, data: { status: 'CANCELLED', failureReason: 'Paid at the gym instead' } });
}

export async function cancelMembership(gymId: string, membershipId: string, reason: string | undefined, actor: Actor) {
  const m = await prisma.membership.findFirst({ where: { id: membershipId, gymId }, include: { gym: { select: { name: true } } } });
  if (!m) throw notFound('Membership not found');
  if (m.status === 'CANCELLED') return;
  await cancelOpenPayments(m.id, 'Membership cancelled by the gym');
  await prisma.membership.update({ where: { id: m.id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
  await audit({ ...who(actor), action: 'membership.cancelled_by_gym', entity: 'membership', entityId: m.id, gymId, before: { status: m.status, endsAt: m.endsAt }, after: { reason } });
  await notify(m.memberId, { type: 'membership.cancelled', title: `${m.gym.name} cancelled your membership`, body: reason ?? 'Contact the gym if you think this is a mistake.' });
}

// ───────────────────────── trainers ─────────────────────────

export async function listTrainers(gymId: string): Promise<LinkedTrainerRow[]> {
  const rows = await prisma.trainerGym.findMany({ where: { gymId }, include: { trainer: { include: { user: { select: { fullName: true, email: true } } } } }, orderBy: { createdAt: 'asc' } });
  return rows.map((r) => ({
    trainerId: r.trainerId,
    fullName: r.trainer.user.fullName,
    email: r.trainer.user.email,
    photoUrl: r.trainer.photoUrl,
    specialties: r.trainer.specialties,
    verificationStatus: r.trainer.verificationStatus,
    linkedAt: r.createdAt.toISOString(),
  }));
}

export async function linkTrainer(gymId: string, email: string, actor: Actor) {
  const t = await prisma.trainer.findFirst({ where: { user: { email, role: 'TRAINER', status: 'ACTIVE' } }, include: { user: true } });
  if (!t) throw notFound('No trainer account with that email. Ask them to register as a trainer on DIVE-IN first.');
  const exists = await prisma.trainerGym.findUnique({ where: { trainerId_gymId: { trainerId: t.id, gymId } } });
  if (exists) throw conflict(`${t.user.fullName} is already linked to this gym`);
  const gym = await prisma.gym.findUniqueOrThrow({ where: { id: gymId }, select: { name: true } });
  await prisma.trainerGym.create({ data: { trainerId: t.id, gymId } });
  await audit({ ...who(actor), action: 'trainer.linked', entity: 'trainer', entityId: t.id, gymId });
  await notify(t.userId, { type: 'trainer.linked', title: `You were added to ${gym.name}`, body: 'Your profile now shows this gym.', link: '/trainer' });
}

export async function unlinkTrainer(gymId: string, trainerId: string, actor: Actor) {
  const r = await prisma.trainerGym.deleteMany({ where: { gymId, trainerId } });
  if (!r.count) throw notFound('Trainer is not linked to this gym');
  await audit({ ...who(actor), action: 'trainer.unlinked', entity: 'trainer', entityId: trainerId, gymId });
}

// ───────────────────────── staff ─────────────────────────

/** Readable temporary password, e.g. "kq7m-x3vd-9p". Shown to the owner once, never stored in plain text. */
function tempPassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  do {
    s = Array.from(crypto.randomBytes(10), (b) => alphabet[b % alphabet.length]).join('');
  } while (!/\d/.test(s) || !/[a-z]/.test(s));
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}

export async function listStaff(gymId: string): Promise<StaffRow[]> {
  const rows = await prisma.gymStaff.findMany({ where: { gymId }, include: { user: true }, orderBy: { createdAt: 'asc' } });
  return rows.map((s) => ({
    id: s.id,
    userId: s.userId,
    fullName: s.user.fullName,
    email: s.user.email,
    phone: s.user.phone,
    active: s.active && s.user.status === 'ACTIVE',
    mustChangePassword: s.user.mustChangePassword,
    lastLoginAt: s.user.lastLoginAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
  }));
}

export async function createStaff(gymId: string, input: z.output<typeof staffCreateSchema>, actor: Actor) {
  if (await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } })) {
    throw conflict('That email already has a DIVE-IN account', { email: 'Already registered — use a different email' });
  }
  if ((await prisma.gymStaff.count({ where: { gymId, active: true } })) >= 20) throw badRequest('A gym can have at most 20 active staff accounts');
  const password = tempPassword();
  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  const staff = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { email: input.email, fullName: input.fullName, phone: input.phone, role: 'RECEPTIONIST', passwordHash, mustChangePassword: true } });
    const s = await tx.gymStaff.create({ data: { gymId, userId: user.id, createdById: actor.id } });
    await audit({ ...who(actor), action: 'staff.created', entity: 'user', entityId: user.id, gymId, after: { fullName: input.fullName, email: input.email } }, tx);
    return s;
  });
  return { staffId: staff.id, temporaryPassword: password };
}

async function loadStaff(gymId: string, staffId: string) {
  const s = await prisma.gymStaff.findFirst({ where: { id: staffId, gymId }, include: { user: true } });
  if (!s) throw notFound('Staff account not found');
  return s;
}

export async function setStaffActive(gymId: string, staffId: string, active: boolean, actor: Actor) {
  const s = await loadStaff(gymId, staffId);
  await prisma.$transaction([
    prisma.gymStaff.update({ where: { id: s.id }, data: { active } }),
    prisma.user.update({ where: { id: s.userId }, data: { status: active ? 'ACTIVE' : 'SUSPENDED' } }),
    // Deactivation signs them out everywhere immediately.
    ...(active ? [] : [prisma.refreshToken.updateMany({ where: { userId: s.userId, revokedAt: null }, data: { revokedAt: new Date() } })]),
  ]);
  await audit({ ...who(actor), action: active ? 'staff.reactivated' : 'staff.deactivated', entity: 'user', entityId: s.userId, gymId });
}

export async function resetStaffPassword(gymId: string, staffId: string, actor: Actor) {
  const s = await loadStaff(gymId, staffId);
  const password = tempPassword();
  await prisma.$transaction([
    prisma.user.update({ where: { id: s.userId }, data: { passwordHash: await bcrypt.hash(password, env.BCRYPT_ROUNDS), mustChangePassword: true } }),
    prisma.refreshToken.updateMany({ where: { userId: s.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  await audit({ ...who(actor), action: 'staff.password_reset', entity: 'user', entityId: s.userId, gymId });
  return { temporaryPassword: password };
}
