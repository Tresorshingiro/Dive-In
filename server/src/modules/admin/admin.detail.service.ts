import { Prisma } from '@prisma/client';
import {
  formatMembershipNumber,
  type ActivityItem,
  type AdminGymDetail,
  type AdminPaymentDetail,
  type AdminTrainerDetail,
  type AdminUserDetail,
} from '@dive/shared';
import { prisma } from '../../lib/prisma';
import { notFound } from '../../lib/errors';
import { DAY_MS } from '../../lib/time';
import { describe } from '../payments/payments.service';
import { effectiveStatus } from '../memberships/memberships.service';

const iso = (d: Date | null | undefined) => d?.toISOString() ?? null;

async function activity(where: Prisma.AuditLogWhereInput, take = 25): Promise<ActivityItem[]> {
  const rows = await prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take, include: { actor: { select: { fullName: true } } } });
  return rows.map((r) => ({ id: r.id, action: r.action, actorName: r.actor?.fullName ?? null, actorRole: r.actorRole, after: r.after, createdAt: r.createdAt.toISOString() }));
}

// ───────────────────────── gym ─────────────────────────

export async function gymDetail(id: string): Promise<AdminGymDetail> {
  const g = await prisma.gym.findUnique({
    where: { id },
    include: {
      owner: true,
      photos: { orderBy: { sortOrder: 'asc' } },
      packages: { orderBy: [{ sortOrder: 'asc' }, { priceRwf: 'asc' }] },
      staff: { include: { user: true }, orderBy: { createdAt: 'asc' } },
      trainers: { include: { trainer: { include: { user: { select: { fullName: true } } } } } },
      subscriptions: { orderBy: { startsAt: 'desc' }, take: 12 },
    },
  });
  if (!g) throw notFound('Gym not found');
  const now = new Date();
  const since = new Date(now.getTime() - 30 * DAY_MS);
  const [activeMembers, awaitingPayment, totalMembers, checkIns30d, money] = await Promise.all([
    prisma.membership.count({ where: { gymId: id, status: 'ACTIVE', endsAt: { gt: now } } }),
    prisma.membership.count({ where: { gymId: id, status: 'AWAITING_PAYMENT' } }),
    prisma.membership.count({ where: { gymId: id, status: { not: 'CANCELLED' } } }),
    prisma.checkIn.count({ where: { gymId: id, result: 'ALLOWED', createdAt: { gte: since } } }),
    prisma.$queryRaw<{ share: bigint | null; comm: bigint | null }[]>`
      SELECT SUM(p.payee_share_rwf) AS share, SUM(p.commission_rwf) AS comm
      FROM payments p JOIN memberships m ON m.id = p.target_id
      WHERE p.purpose = 'MEMBERSHIP' AND p.status = 'PAID' AND m.gym_id = ${id}::uuid AND p.paid_at >= ${since}`,
  ]);
  return {
    id: g.id,
    name: g.name,
    slug: g.slug,
    status: g.status,
    statusNote: g.statusNote,
    description: g.description,
    neighbourhood: g.neighbourhood,
    address: g.address,
    lat: Number(g.lat ?? 0),
    lng: Number(g.lng ?? 0),
    phone: g.phone,
    email: g.email,
    openingHours: (g.openingHours as Record<string, string> | null) ?? null,
    tags: g.tags,
    amenities: g.amenities,
    diveCheckoutEnabled: g.diveCheckoutEnabled,
    commissionOptIn: g.commissionOptIn,
    createdAt: g.createdAt.toISOString(),
    approvedAt: iso(g.approvedAt),
    owner: { id: g.owner.id, fullName: g.owner.fullName, email: g.owner.email, phone: g.owner.phone, createdAt: g.owner.createdAt.toISOString(), lastLoginAt: iso(g.owner.lastLoginAt) },
    photos: g.photos.map((p) => ({ url: p.url, caption: p.caption })),
    packages: g.packages.map((p) => ({ id: p.id, name: p.name, durationDays: p.durationDays, priceRwf: p.priceRwf, active: p.active, perks: p.perks })),
    staff: g.staff.map((s) => ({ id: s.id, userId: s.userId, fullName: s.user.fullName, email: s.user.email, active: s.active && s.user.status === 'ACTIVE', lastLoginAt: iso(s.user.lastLoginAt) })),
    trainers: g.trainers.map((t) => ({ id: t.trainerId, fullName: t.trainer.user.fullName, verificationStatus: t.trainer.verificationStatus, photoUrl: t.trainer.photoUrl })),
    subscriptions: g.subscriptions.map((s) => ({ id: s.id, plan: s.plan, status: s.status, priceRwf: s.priceRwf, startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString() })),
    stats: { activeMembers, awaitingPayment, totalMembers, checkIns30d, revenue30dRwf: Number(money[0]?.share ?? 0), commission30dRwf: Number(money[0]?.comm ?? 0) },
    activity: await activity({ OR: [{ gymId: id }, { entity: 'gym', entityId: id }] }),
  };
}

// ───────────────────────── trainer ─────────────────────────

export async function trainerDetail(id: string): Promise<AdminTrainerDetail> {
  const t = await prisma.trainer.findUnique({
    where: { id },
    include: {
      user: true,
      gyms: { include: { gym: { select: { id: true, name: true, neighbourhood: true, slug: true } } } },
      availability: { orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }] },
    },
  });
  if (!t) throw notFound('Trainer not found');
  const now = new Date();
  const gymNames = new Map(t.gyms.map((g) => [g.gymId, g.gym.name]));
  const [upcoming, completed, cancelled, earned, conversations, recent] = await Promise.all([
    prisma.booking.count({ where: { trainerId: id, status: 'CONFIRMED', startsAt: { gt: now } } }),
    prisma.booking.count({ where: { trainerId: id, OR: [{ status: 'COMPLETED' }, { status: 'CONFIRMED', endsAt: { lt: now } }] } }),
    prisma.booking.count({ where: { trainerId: id, status: 'CANCELLED' } }),
    prisma.$queryRaw<{ total: bigint | null }[]>`
      SELECT SUM(p.payee_share_rwf) AS total FROM payments p JOIN bookings b ON b.id = p.target_id
      WHERE p.purpose = 'SESSION' AND p.status = 'PAID' AND b.trainer_id = ${id}::uuid`,
    prisma.conversation.count({ where: { trainerId: id } }),
    prisma.booking.findMany({ where: { trainerId: id, status: { not: 'EXPIRED' } }, orderBy: { startsAt: 'desc' }, take: 10, include: { member: { select: { fullName: true } } } }),
  ]);
  return {
    id: t.id,
    userId: t.userId,
    fullName: t.user.fullName,
    email: t.user.email,
    phone: t.user.phone,
    accountStatus: t.user.status,
    createdAt: t.createdAt.toISOString(),
    lastLoginAt: iso(t.user.lastLoginAt),
    headline: t.headline,
    bio: t.bio,
    photoUrl: t.photoUrl,
    specialties: t.specialties,
    certifications: t.certifications,
    languages: t.languages,
    yearsExperience: t.yearsExperience,
    sessionFeeRwf: t.sessionFeeRwf,
    sessionMinutes: t.sessionMinutes,
    verificationStatus: t.verificationStatus,
    verifiedAt: iso(t.verifiedAt),
    gyms: t.gyms.map((g) => g.gym),
    availability: t.availability.map((a) => ({ weekday: a.weekday, startTime: a.startTime, endTime: a.endTime, gymName: a.gymId ? (gymNames.get(a.gymId) ?? null) : null })),
    stats: { upcoming, completed, cancelled, earnedRwf: Number(earned[0]?.total ?? 0), conversations },
    recentBookings: recent.map((b) => ({ id: b.id, memberName: b.member.fullName, startsAt: b.startsAt.toISOString(), status: b.status, feeRwf: b.feeRwf })),
    activity: await activity({ OR: [{ entity: 'trainer', entityId: id }, { actorId: t.userId }] }),
  };
}

// ───────────────────────── user ─────────────────────────

export async function userDetail(id: string): Promise<AdminUserDetail> {
  const u = await prisma.user.findUnique({
    where: { id },
    include: {
      ownedGyms: { select: { id: true, name: true, status: true } },
      staffOf: { include: { gym: { select: { name: true } } } },
      trainer: { select: { id: true } },
      memberships: { include: { gym: { select: { name: true } }, package: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 20 },
      coachPasses: { orderBy: { startsAt: 'desc' }, take: 10 },
      bookings: { include: { trainer: { include: { user: { select: { fullName: true } } } } }, orderBy: { startsAt: 'desc' }, take: 15 },
    },
  });
  if (!u) throw notFound('User not found');
  const payments = await prisma.payment.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 20 });
  const view = await describe(payments);
  return {
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    phone: u.phone,
    role: u.role,
    status: u.status,
    mustChangePassword: u.mustChangePassword,
    mfaEnabled: !!u.totpEnabledAt,
    createdAt: u.createdAt.toISOString(),
    lastLoginAt: iso(u.lastLoginAt),
    ownedGyms: u.ownedGyms,
    staffOf: u.staffOf ? { gymId: u.staffOf.gymId, gymName: u.staffOf.gym.name, active: u.staffOf.active } : null,
    trainerId: u.trainer?.id ?? null,
    memberships: u.memberships.map((m) => ({ id: m.id, number: formatMembershipNumber(m.number), gymName: m.gym.name, packageName: m.package.name, status: effectiveStatus(m), endsAt: iso(m.endsAt) })),
    coachPasses: u.coachPasses.map((p) => ({ id: p.id, startsAt: p.startsAt.toISOString(), endsAt: p.endsAt.toISOString(), priceRwf: p.priceRwf })),
    bookings: u.bookings.map((b) => ({ id: b.id, trainerName: b.trainer.user.fullName, startsAt: b.startsAt.toISOString(), status: b.status, feeRwf: b.feeRwf })),
    payments: payments.map((p) => ({ id: p.id, description: view(p).description, amountRwf: p.amountRwf, status: p.status, method: p.method, createdAt: p.createdAt.toISOString() })),
    activity: await activity({ OR: [{ actorId: id }, { entity: 'user', entityId: id }] }, 30),
  };
}

// ───────────────────────── payment ─────────────────────────

export async function paymentDetail(id: string): Promise<AdminPaymentDetail> {
  const p = await prisma.payment.findUnique({ where: { id }, include: { user: true, events: { orderBy: { receivedAt: 'asc' } } } });
  if (!p) throw notFound('Payment not found');
  const view = (await describe([p]))(p);
  const recordedBy = p.recordedById ? await prisma.user.findUnique({ where: { id: p.recordedById }, select: { id: true, fullName: true } }) : null;

  let target: AdminPaymentDetail['target'] = null;
  if (p.purpose === 'MEMBERSHIP') {
    const m = await prisma.membership.findUnique({ where: { id: p.targetId }, include: { gym: { select: { id: true, name: true } }, package: { select: { name: true } } } });
    if (m) target = { kind: 'Membership', id: m.id, label: `${formatMembershipNumber(m.number)} · ${m.gym.name} · ${m.package.name} · ${effectiveStatus(m).toLowerCase().replace('_', ' ')}`, adminLink: `/admin/gyms/${m.gym.id}` };
  } else if (p.purpose === 'SESSION') {
    const b = await prisma.booking.findUnique({ where: { id: p.targetId }, include: { trainer: { include: { user: { select: { fullName: true } } } } } });
    if (b) target = { kind: 'Coaching session', id: b.id, label: `${b.trainer.user.fullName} · ${b.startsAt.toLocaleString('en-GB', { timeZone: 'Africa/Kigali', dateStyle: 'medium', timeStyle: 'short' })} · ${b.status.toLowerCase().replace('_', ' ')}`, adminLink: `/admin/trainers/${b.trainerId}` };
  } else if (p.purpose === 'COACH_PASS') {
    const pass = await prisma.coachAccessPass.findUnique({ where: { id: p.targetId } });
    target = { kind: 'Coach Access Pass', id: p.targetId, label: pass ? `valid ${pass.startsAt.toLocaleDateString('en-GB')} → ${pass.endsAt.toLocaleDateString('en-GB')}` : 'not activated (payment not completed)', adminLink: null };
  } else if (p.purpose === 'GYM_SUBSCRIPTION') {
    const gymId = (p.meta as { gymId?: string } | null)?.gymId;
    const gym = gymId ? await prisma.gym.findUnique({ where: { id: gymId }, select: { id: true, name: true } }) : null;
    if (gym) target = { kind: 'Partner plan', id: gym.id, label: `${gym.name} · ${String((p.meta as { plan?: string }).plan ?? '').toLowerCase()}`, adminLink: `/admin/gyms/${gym.id}` };
  }

  return {
    id: p.id,
    purpose: p.purpose,
    status: p.status,
    method: p.method,
    provider: p.provider,
    providerRef: p.providerRef,
    amountRwf: p.amountRwf,
    commissionRwf: p.commissionRwf,
    payeeShareRwf: p.payeeShareRwf,
    description: view.description,
    failureReason: p.failureReason,
    idempotencyKey: p.idempotencyKey,
    createdAt: p.createdAt.toISOString(),
    paidAt: iso(p.paidAt),
    verifiedAt: iso(p.verifiedAt),
    expiresAt: iso(p.expiresAt),
    user: { id: p.user.id, fullName: p.user.fullName, email: p.user.email, phone: p.user.phone },
    recordedBy,
    target,
    events: p.events.map((e) => ({ id: e.id, eventId: e.eventId, type: e.type, processed: e.processed, receivedAt: e.receivedAt.toISOString() })),
    activity: await activity({ OR: [{ entity: 'payment', entityId: id }, ...(target ? [{ entityId: target.id }] : [])] }),
  };
}
