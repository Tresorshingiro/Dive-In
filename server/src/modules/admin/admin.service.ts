import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Prisma, type Role } from '@prisma/client';
import {
  CONFIG_KEYS,
  type AdminGymRow,
  type AdminOverview,
  type AdminPaymentRow,
  type AdminTrainerRow,
  type AdminUserRow,
  type AuditRow,
} from '@dive/shared';
import type { z } from 'zod';
import type { platformConfigSchema } from '@dive/shared';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { audit } from '../../lib/audit';
import { notify } from '../../lib/notify';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors';
import { getConfig, getPublicConfig } from '../../lib/platformConfig';
import { DAY_MS, kigaliDayStart, kigaliMonthStart } from '../../lib/time';
import { describe } from '../payments/payments.service';

export interface Admin {
  id: string;
  ip?: string | null;
}
const by = (a: Admin) => ({ actorId: a.id, actorRole: 'ADMIN' as Role, ip: a.ip ?? null });
const PAGE = 30;

// ───────────────────────── overview ─────────────────────────

export async function overview(): Promise<AdminOverview> {
  const month = kigaliMonthStart();
  const sixMonths = kigaliMonthStart(5);
  const now = new Date();
  const [roles, gyms, trainersPending, activeMemberships, checkInsToday, bookingsUpcoming, contactUnhandled, review] = await Promise.all([
    prisma.user.groupBy({ by: ['role'], _count: true }),
    prisma.gym.groupBy({ by: ['status'], _count: true }),
    prisma.trainer.count({ where: { verificationStatus: 'PENDING' } }),
    prisma.membership.count({ where: { status: 'ACTIVE', endsAt: { gt: now } } }),
    prisma.checkIn.count({ where: { result: 'ALLOWED', createdAt: { gte: kigaliDayStart() } } }),
    prisma.booking.count({ where: { status: 'CONFIRMED', startsAt: { gt: now } } }),
    prisma.contactMessage.count({ where: { handledAt: null } }),
    prisma.payment.count({ where: { failureReason: { startsWith: 'NEEDS_REVIEW' } } }),
  ]);

  const [m] = await prisma.$queryRaw<{ commission: bigint | null; pass: bigint | null; subs: bigint | null; processed: bigint | null }[]>`
    SELECT SUM(commission_rwf) FILTER (WHERE purpose = 'MEMBERSHIP') AS commission,
           SUM(amount_rwf) FILTER (WHERE purpose = 'COACH_PASS') AS pass,
           SUM(amount_rwf) FILTER (WHERE purpose = 'GYM_SUBSCRIPTION') AS subs,
           SUM(amount_rwf) FILTER (WHERE method <> 'PAID_AT_GYM') AS processed
    FROM payments WHERE status = 'PAID' AND paid_at >= ${month}`;
  const byMonth = await prisma.$queryRaw<{ month: string; commission: bigint; pass: bigint; subs: bigint }[]>`
    SELECT to_char((paid_at AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Kigali', 'YYYY-MM') AS month,
           COALESCE(SUM(commission_rwf) FILTER (WHERE purpose = 'MEMBERSHIP'), 0) AS commission,
           COALESCE(SUM(amount_rwf) FILTER (WHERE purpose = 'COACH_PASS'), 0) AS pass,
           COALESCE(SUM(amount_rwf) FILTER (WHERE purpose = 'GYM_SUBSCRIPTION'), 0) AS subs
    FROM payments WHERE status = 'PAID' AND paid_at >= ${sixMonths} GROUP BY 1`;
  const signups = await prisma.$queryRaw<{ month: string; role: string; n: bigint }[]>`
    SELECT to_char((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Kigali', 'YYYY-MM') AS month, role::text AS role, COUNT(*) AS n
    FROM users WHERE created_at >= ${sixMonths} AND role IN ('MEMBER', 'GYM_OWNER', 'TRAINER') GROUP BY 1, 2`;

  const months = Array.from({ length: 6 }, (_, i) => new Date(kigaliMonthStart(5 - i).getTime() + 2 * 3600_000).toISOString().slice(0, 7));
  const commission = Number(m?.commission ?? 0);
  const coachPass = Number(m?.pass ?? 0);
  const subscriptions = Number(m?.subs ?? 0);
  const g = Object.fromEntries(gyms.map((x) => [x.status, x._count]));
  return {
    users: Object.fromEntries(roles.map((r) => [r.role, r._count])),
    gyms: { PENDING: g.PENDING ?? 0, APPROVED: g.APPROVED ?? 0, REJECTED: g.REJECTED ?? 0, SUSPENDED: g.SUSPENDED ?? 0 },
    trainersPending,
    activeMemberships,
    checkInsToday,
    bookingsUpcoming,
    contactUnhandled,
    paymentsNeedingReview: review,
    revenueThisMonth: { commission, coachPass, subscriptions, total: commission + coachPass + subscriptions },
    processedThisMonthRwf: Number(m?.processed ?? 0),
    revenueByMonth: months.map((mo) => {
      const r = byMonth.find((x) => x.month === mo);
      return { month: mo, commission: Number(r?.commission ?? 0), coachPass: Number(r?.pass ?? 0), subscriptions: Number(r?.subs ?? 0) };
    }),
    signupsByMonth: months.map((mo) => {
      const n = (role: string) => Number(signups.find((s) => s.month === mo && s.role === role)?.n ?? 0);
      return { month: mo, members: n('MEMBER'), gyms: n('GYM_OWNER'), trainers: n('TRAINER') };
    }),
  };
}

// ───────────────────────── gyms ─────────────────────────

export async function listGyms(status?: string): Promise<AdminGymRow[]> {
  const rows = await prisma.gym.findMany({
    where: status ? { status: status as never } : {},
    include: {
      owner: { select: { id: true, fullName: true, email: true, phone: true } },
      subscriptions: { where: { status: 'ACTIVE' }, orderBy: { endsAt: 'desc' }, take: 1 },
      _count: { select: { packages: true, photos: true } },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });
  const active = await prisma.membership.groupBy({ by: ['gymId'], where: { status: 'ACTIVE', endsAt: { gt: new Date() } }, _count: true });
  const activeBy = new Map(active.map((a) => [a.gymId, a._count]));
  return rows.map((g) => ({
    id: g.id,
    name: g.name,
    slug: g.slug,
    neighbourhood: g.neighbourhood,
    status: g.status,
    statusNote: g.statusNote,
    owner: g.owner,
    createdAt: g.createdAt.toISOString(),
    approvedAt: g.approvedAt?.toISOString() ?? null,
    activeMembers: activeBy.get(g.id) ?? 0,
    packages: g._count.packages,
    photos: g._count.photos,
    diveCheckoutEnabled: g.diveCheckoutEnabled,
    commissionOptIn: g.commissionOptIn,
    subscription: g.subscriptions[0] ? { plan: g.subscriptions[0].plan, endsAt: g.subscriptions[0].endsAt.toISOString() } : null,
  }));
}

export async function setGymStatus(gymId: string, action: 'approve' | 'reject' | 'suspend' | 'reinstate', note: string | undefined, admin: Admin) {
  const g = await prisma.gym.findUnique({ where: { id: gymId } });
  if (!g) throw notFound('Gym not found');
  const allowed: Record<typeof action, string[]> = { approve: ['PENDING', 'REJECTED'], reject: ['PENDING'], suspend: ['APPROVED'], reinstate: ['SUSPENDED'] };
  if (!allowed[action].includes(g.status)) throw badRequest(`Can't ${action} a gym that is ${g.status.toLowerCase()}`);
  const next = action === 'approve' || action === 'reinstate' ? 'APPROVED' : action === 'reject' ? 'REJECTED' : 'SUSPENDED';
  const trialDays = await getConfig(CONFIG_KEYS.trialDays);

  await prisma.$transaction(async (tx) => {
    await tx.gym.update({ where: { id: gymId }, data: { status: next, statusNote: note ?? null, ...(action === 'approve' ? { approvedAt: new Date() } : {}) } });
    // The free trial starts on first approval.
    if (action === 'approve' && !(await tx.gymSubscription.count({ where: { gymId } }))) {
      await tx.gymSubscription.create({ data: { gymId, plan: 'TRIAL', priceRwf: 0, startsAt: new Date(), endsAt: new Date(Date.now() + trialDays * DAY_MS) } });
    }
    await audit({ ...by(admin), action: `gym.${action}`, entity: 'gym', entityId: gymId, gymId, before: { status: g.status }, after: { status: next, note } }, tx);
    const msg = {
      approve: { title: `${g.name} is live on DIVE-IN`, body: `Your gym is approved and visible to members. Your ${trialDays}-day free trial has started.` },
      reject: { title: `${g.name} was not approved`, body: note ?? 'Contact DIVE-IN support for details.' },
      suspend: { title: `${g.name} is suspended`, body: note ?? 'Your gym is hidden from members. Contact DIVE-IN support.' },
      reinstate: { title: `${g.name} is live again`, body: 'Your gym is visible to members again.' },
    }[action];
    await notify(g.ownerId, { type: `gym.${action}`, ...msg, link: '/gym' }, tx);
  });
}

// ───────────────────────── trainers ─────────────────────────

export async function listTrainers(status?: string): Promise<AdminTrainerRow[]> {
  const rows = await prisma.trainer.findMany({
    where: status ? { verificationStatus: status as never } : {},
    include: { user: { select: { fullName: true, email: true, phone: true, createdAt: true } }, gyms: { include: { gym: { select: { name: true } } } } },
    orderBy: [{ verificationStatus: 'asc' }, { createdAt: 'desc' }],
  });
  return rows.map((t) => ({
    id: t.id,
    userId: t.userId,
    fullName: t.user.fullName,
    email: t.user.email,
    phone: t.user.phone,
    headline: t.headline,
    specialties: t.specialties,
    certifications: t.certifications,
    yearsExperience: t.yearsExperience,
    photoUrl: t.photoUrl,
    verificationStatus: t.verificationStatus,
    gyms: t.gyms.map((g) => g.gym.name),
    createdAt: t.createdAt.toISOString(),
  }));
}

export async function setTrainerStatus(trainerId: string, status: 'VERIFIED' | 'REJECTED' | 'PENDING', note: string | undefined, admin: Admin) {
  const t = await prisma.trainer.findUnique({ where: { id: trainerId } });
  if (!t) throw notFound('Trainer not found');
  await prisma.trainer.update({ where: { id: trainerId }, data: { verificationStatus: status, verifiedAt: status === 'VERIFIED' ? new Date() : null } });
  await audit({ ...by(admin), action: `trainer.${status.toLowerCase()}`, entity: 'trainer', entityId: trainerId, before: { status: t.verificationStatus }, after: { status, note } });
  await notify(t.userId, {
    type: `trainer.${status.toLowerCase()}`,
    title: status === 'VERIFIED' ? 'Your coach profile is verified' : status === 'REJECTED' ? 'Your coach profile was not verified' : 'Your verification was reopened',
    body: status === 'VERIFIED' ? 'Members can now find and book you on DIVE-IN.' : (note ?? 'Contact DIVE-IN support for details.'),
    link: '/trainer',
  });
}

// ───────────────────────── users ─────────────────────────

export async function listUsers(q: { q?: string; role?: string; status?: string; page: number }) {
  const where: Prisma.UserWhereInput = {
    ...(q.role ? { role: q.role as Role } : {}),
    ...(q.status ? { status: q.status as never } : {}),
    ...(q.q ? { OR: [{ fullName: { contains: q.q, mode: 'insensitive' } }, { email: { contains: q.q.toLowerCase() } }, { phone: { contains: q.q.replace(/\s/g, '') } }] } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * PAGE, take: PAGE }),
  ]);
  const out: AdminUserRow[] = rows.map((u) => ({
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    phone: u.phone,
    role: u.role,
    status: u.status,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
    mfaEnabled: !!u.totpEnabledAt,
  }));
  return { rows: out, total, page: q.page, pageSize: PAGE };
}

export async function setUserStatus(userId: string, status: 'ACTIVE' | 'SUSPENDED', admin: Admin) {
  if (userId === admin.id) throw forbidden("You can't suspend your own account");
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) throw notFound('User not found');
  if (u.role === 'ADMIN' && status === 'SUSPENDED' && (await prisma.user.count({ where: { role: 'ADMIN', status: 'ACTIVE' } })) <= 1) throw forbidden('At least one active admin must remain');
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { status } }),
    ...(status === 'SUSPENDED' ? [prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } })] : []),
  ]);
  await audit({ ...by(admin), action: status === 'SUSPENDED' ? 'user.suspended' : 'user.reactivated', entity: 'user', entityId: userId, before: { status: u.status }, after: { status } });
}

function tempPassword() {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  do s = Array.from(crypto.randomBytes(10), (b) => a[b % a.length]).join('');
  while (!/\d/.test(s) || !/[a-z]/.test(s));
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}

export async function resetPassword(userId: string, admin: Admin) {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) throw notFound('User not found');
  const password = tempPassword();
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(password, env.BCRYPT_ROUNDS), mustChangePassword: true } }),
    prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  await audit({ ...by(admin), action: 'user.password_reset', entity: 'user', entityId: userId });
  return { temporaryPassword: password };
}

/** Lost phone: the admin sets up two-factor sign-in again on their next login. */
export async function resetMfa(userId: string, admin: Admin) {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u || u.role !== 'ADMIN') throw notFound('Admin not found');
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { totpSecret: null, totpEnabledAt: null, totpLastStep: null } }),
    prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  await audit({ ...by(admin), action: 'user.mfa_reset', entity: 'user', entityId: userId });
}

export async function createAdmin(fullName: string, email: string, admin: Admin) {
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) throw conflict('That email already has a DIVE-IN account', { email: 'Already registered' });
  const password = tempPassword();
  const u = await prisma.user.create({ data: { fullName, email, role: 'ADMIN', passwordHash: await bcrypt.hash(password, env.BCRYPT_ROUNDS), mustChangePassword: true } });
  await audit({ ...by(admin), action: 'user.admin_created', entity: 'user', entityId: u.id, after: { fullName, email } });
  return { userId: u.id, temporaryPassword: password };
}

// ───────────────────────── payments ─────────────────────────

export async function listPayments(q: { status?: string; purpose?: string; page: number }) {
  const where: Prisma.PaymentWhereInput = {
    ...(q.purpose ? { purpose: q.purpose as never } : {}),
    ...(q.status === 'REVIEW' ? { failureReason: { startsWith: 'NEEDS_REVIEW' } } : q.status ? { status: q.status as never } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({ where, include: { user: { select: { fullName: true, email: true } } }, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * PAGE, take: PAGE }),
  ]);
  const view = await describe(rows);
  const out: AdminPaymentRow[] = rows.map((p) => ({
    id: p.id,
    purpose: p.purpose,
    status: p.status,
    method: p.method,
    provider: p.provider,
    amountRwf: p.amountRwf,
    commissionRwf: p.commissionRwf,
    userName: p.user.fullName,
    userEmail: p.user.email,
    description: view(p).description,
    failureReason: p.failureReason,
    needsReview: !!p.failureReason?.startsWith('NEEDS_REVIEW'),
    createdAt: p.createdAt.toISOString(),
    paidAt: p.paidAt?.toISOString() ?? null,
  }));
  return { rows: out, total, page: q.page, pageSize: PAGE };
}

/** Clears the review flag once support has handled it outside a refund (e.g. rebooked the member). */
export async function resolveReview(paymentId: string, note: string | undefined, admin: Admin) {
  const p = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!p?.failureReason?.startsWith('NEEDS_REVIEW')) throw badRequest('This payment is not flagged for review');
  await prisma.payment.update({ where: { id: paymentId }, data: { failureReason: `Reviewed: ${note ?? 'resolved by support'}` } });
  await audit({ ...by(admin), action: 'payment.review_resolved', entity: 'payment', entityId: paymentId, before: { failureReason: p.failureReason }, after: { note } });
}

// ───────────────────────── platform config ─────────────────────────

export async function getConfigForAdmin() {
  const pub = await getPublicConfig();
  const plans = await getConfig(CONFIG_KEYS.gymPlans);
  return { coachPass: pub.coachPass, gymPlans: plans, commissionPercent: pub.commissionPercent, trialDays: pub.trialDays };
}

export async function updateConfig(input: z.output<typeof platformConfigSchema>, admin: Admin) {
  const before = await getConfigForAdmin();
  const rows: Array<[string, Prisma.InputJsonValue]> = [
    [CONFIG_KEYS.coachPass, input.coachPass],
    [CONFIG_KEYS.gymPlans, input.gymPlans],
    [CONFIG_KEYS.commission, { percent: input.commissionPercent }],
    [CONFIG_KEYS.trialDays, input.trialDays],
  ];
  await prisma.$transaction(rows.map(([key, value]) => prisma.platformConfig.upsert({ where: { key }, create: { key, value, updatedById: admin.id }, update: { value, updatedById: admin.id } })));
  await audit({ ...by(admin), action: 'config.updated', entity: 'platform_config', before, after: input });
  return getConfigForAdmin();
}

// ───────────────────────── contact + audit ─────────────────────────

export async function listContact(unhandledOnly: boolean) {
  const rows = await prisma.contactMessage.findMany({ where: unhandledOnly ? { handledAt: null } : {}, orderBy: { createdAt: 'desc' }, take: 100 });
  return rows.map((c) => ({ ...c, ip: undefined, createdAt: c.createdAt.toISOString(), handledAt: c.handledAt?.toISOString() ?? null }));
}

export async function handleContact(id: string, admin: Admin) {
  const r = await prisma.contactMessage.updateMany({ where: { id, handledAt: null }, data: { handledAt: new Date() } });
  if (r.count) await audit({ ...by(admin), action: 'contact.handled', entity: 'contact_message', entityId: id });
}

export async function auditLog(q: { action?: string; actor?: string; page: number }) {
  const where: Prisma.AuditLogWhereInput = {
    ...(q.action ? { action: { startsWith: q.action } } : {}),
    ...(q.actor ? { actor: { OR: [{ fullName: { contains: q.actor, mode: 'insensitive' } }, { email: { contains: q.actor.toLowerCase() } }] } } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, include: { actor: { select: { fullName: true } } }, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * 50, take: 50 }),
  ]);
  const gyms = new Map((await prisma.gym.findMany({ where: { id: { in: rows.map((r) => r.gymId).filter(Boolean) as string[] } }, select: { id: true, name: true } })).map((g) => [g.id, g.name]));
  const out: AuditRow[] = rows.map((r) => ({
    id: r.id,
    action: r.action,
    actorName: r.actor?.fullName ?? null,
    actorRole: r.actorRole,
    entity: r.entity,
    entityId: r.entityId,
    gymName: r.gymId ? (gyms.get(r.gymId) ?? null) : null,
    before: r.before,
    after: r.after,
    ip: r.ip,
    createdAt: r.createdAt.toISOString(),
  }));
  return { rows: out, total, page: q.page, pageSize: 50 };
}
