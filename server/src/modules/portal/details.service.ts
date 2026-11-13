import { formatMembershipNumber, type GymStaffDetail, type GymTrainerDetail, type Receipt, type SessionDetail } from '@dive/shared';
import { prisma } from '../../lib/prisma';
import { notFound } from '../../lib/errors';
import { DAY_MS, kigaliDayStart } from '../../lib/time';
import { describe, syncPayment } from '../payments/payments.service';

const iso = (d: Date | null | undefined) => d?.toISOString() ?? null;

// ───────────────────────── gym portal ─────────────────────────

/** A trainer linked to this gym (the gym can't open trainers that aren't linked). */
export async function gymTrainer(gymId: string, trainerId: string): Promise<GymTrainerDetail> {
  const link = await prisma.trainerGym.findUnique({
    where: { trainerId_gymId: { trainerId, gymId } },
    include: { trainer: { include: { user: true, availability: { where: { OR: [{ gymId }, { gymId: null }] }, orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }] } } } },
  });
  if (!link) throw notFound('This trainer is not linked to your gym');
  const t = link.trainer;
  const now = new Date();
  const [upcoming, completed] = await Promise.all([
    prisma.booking.count({ where: { trainerId, gymId, status: 'CONFIRMED', startsAt: { gt: now } } }),
    prisma.booking.count({ where: { trainerId, gymId, OR: [{ status: 'COMPLETED' }, { status: 'CONFIRMED', endsAt: { lt: now } }] } }),
  ]);
  return {
    trainerId,
    fullName: t.user.fullName,
    email: t.user.email,
    phone: t.user.phone,
    photoUrl: t.photoUrl,
    headline: t.headline,
    bio: t.bio,
    specialties: t.specialties,
    certifications: t.certifications,
    languages: t.languages,
    yearsExperience: t.yearsExperience,
    sessionFeeRwf: t.sessionFeeRwf,
    sessionMinutes: t.sessionMinutes,
    verificationStatus: t.verificationStatus,
    linkedAt: link.createdAt.toISOString(),
    availabilityHere: t.availability.map((a) => ({ weekday: a.weekday, startTime: a.startTime, endTime: a.endTime })),
    sessionsHere: { upcoming, completed },
  };
}

export async function gymStaff(gymId: string, staffId: string): Promise<GymStaffDetail> {
  const s = await prisma.gymStaff.findFirst({ where: { id: staffId, gymId }, include: { user: true } });
  if (!s) throw notFound('Staff account not found');
  const since = new Date(Date.now() - 30 * DAY_MS);
  const [today, month, refused, recent] = await Promise.all([
    prisma.checkIn.count({ where: { gymId, staffId: s.userId, result: 'ALLOWED', createdAt: { gte: kigaliDayStart() } } }),
    prisma.checkIn.count({ where: { gymId, staffId: s.userId, result: 'ALLOWED', createdAt: { gte: since } } }),
    prisma.checkIn.count({ where: { gymId, staffId: s.userId, result: 'DENIED', createdAt: { gte: since } } }),
    prisma.checkIn.findMany({
      where: { gymId, staffId: s.userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { membership: { select: { number: true, member: { select: { fullName: true } } } } },
    }),
  ]);
  return {
    id: s.id,
    userId: s.userId,
    fullName: s.user.fullName,
    email: s.user.email,
    phone: s.user.phone,
    active: s.active && s.user.status === 'ACTIVE',
    mustChangePassword: s.user.mustChangePassword,
    createdAt: s.createdAt.toISOString(),
    lastLoginAt: iso(s.user.lastLoginAt),
    stats: { checkInsToday: today, checkIns30d: month, refused30d: refused },
    recentCheckIns: recent.map((c) => ({ id: c.id, memberName: c.membership.member.fullName, number: formatMembershipNumber(c.membership.number), result: c.result, reason: c.reason, createdAt: c.createdAt.toISOString() })),
  };
}

// ───────────────────────── sessions (trainer + member) ─────────────────────────

/** One booking, seen by its trainer or its member. Anyone else gets 404. */
export async function session(id: string, viewer: { id: string; role: string }): Promise<SessionDetail> {
  const b = await prisma.booking.findUnique({
    where: { id },
    include: {
      trainer: { include: { user: { select: { id: true, fullName: true, phone: true } } } },
      member: { select: { id: true, fullName: true, phone: true, email: true } },
    },
  });
  const isTrainer = viewer.role === 'TRAINER' && b?.trainer.userId === viewer.id;
  const isMember = viewer.role === 'MEMBER' && b?.memberId === viewer.id;
  if (!b || (!isTrainer && !isMember) || (isMember && b.status === 'EXPIRED')) throw notFound('Session not found');

  const [gym, payments, convo, history] = await Promise.all([
    b.gymId ? prisma.gym.findUnique({ where: { id: b.gymId }, select: { name: true, neighbourhood: true, address: true, slug: true } }) : null,
    prisma.payment.findMany({ where: { purpose: 'SESSION', targetId: b.id }, orderBy: { createdAt: 'desc' }, take: 1 }),
    prisma.conversation.findUnique({ where: { memberId_trainerId: { memberId: b.memberId, trainerId: b.trainerId } }, select: { id: true } }),
    isTrainer
      ? prisma.booking.findMany({ where: { trainerId: b.trainerId, memberId: b.memberId, id: { not: b.id }, status: { in: ['CONFIRMED', 'COMPLETED', 'CANCELLED'] } }, orderBy: { startsAt: 'desc' }, take: 10, select: { id: true, startsAt: true, status: true } })
      : Promise.resolve([]),
  ]);
  const p = payments[0];
  const open = p?.status === 'PENDING' && p.checkoutUrl && (!p.expiresAt || p.expiresAt > new Date());
  return {
    id: b.id,
    status: b.status,
    startsAt: b.startsAt.toISOString(),
    endsAt: b.endsAt.toISOString(),
    feeRwf: b.feeRwf,
    note: b.note,
    cancelReason: b.cancelReason,
    createdAt: b.createdAt.toISOString(),
    completedAt: iso(b.completedAt),
    gym,
    trainer: { id: b.trainer.id, fullName: b.trainer.user.fullName, photoUrl: b.trainer.photoUrl, headline: b.trainer.headline, ...(isMember && b.status === 'CONFIRMED' ? { phone: b.trainer.user.phone } : {}) },
    member: { id: b.member.id, fullName: b.member.fullName, ...(isTrainer ? { phone: b.member.phone, email: b.member.email } : {}) },
    payment: p ? { id: p.id, status: p.status, amountRwf: p.amountRwf, paidAt: iso(p.paidAt), checkoutUrl: open ? p.checkoutUrl : null } : null,
    conversationId: convo?.id ?? null,
    history: history.map((h) => ({ id: h.id, startsAt: h.startsAt.toISOString(), status: h.status })),
  };
}

// ───────────────────────── receipts ─────────────────────────

export async function receipt(userId: string, id: string): Promise<Receipt> {
  let p = await prisma.payment.findFirst({ where: { id, userId }, include: { user: { select: { fullName: true, email: true } } } });
  if (!p) throw notFound('Payment not found');
  const synced = await syncPayment(p);
  if (synced.status !== p.status) p = { ...p, ...synced };
  const view = (await describe([p]))(p);
  const link =
    p.purpose === 'MEMBERSHIP' ? `/app/cards/${p.targetId}` : p.purpose === 'SESSION' ? `/app/coaching/${p.targetId}` : p.purpose === 'COACH_PASS' ? '/coaches' : p.purpose === 'GYM_SUBSCRIPTION' ? '/gym/subscription' : null;
  return {
    id: p.id,
    purpose: p.purpose,
    status: p.status,
    description: view.description,
    amountRwf: p.amountRwf,
    method: p.method,
    provider: p.provider,
    providerRef: p.status === 'PAID' || p.status === 'REFUNDED' ? p.providerRef : null,
    createdAt: p.createdAt.toISOString(),
    paidAt: iso(p.paidAt),
    failureReason: view.failureReason,
    checkoutUrl: view.checkoutUrl,
    payer: p.user,
    link,
  };
}
