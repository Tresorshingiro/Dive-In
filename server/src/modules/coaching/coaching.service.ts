import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { CONFIG_KEYS, formatRwf, type BookingStarted, type BookingView, type CoachPassStatus, type CoachProfile, type ConversationView, type MessageView } from '@dive/shared';
import { prisma } from '../../lib/prisma';
import { audit } from '../../lib/audit';
import { notify } from '../../lib/notify';
import { getConfig } from '../../lib/platformConfig';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors';
import { startOnlinePayment, checkoutExpiry } from '../../lib/onlinePayment';
import { cancelOpenPaymentsFor } from '../payments/payments.helpers';
import { trainerSlots } from './slots';

type Member = { id: string; email: string; role: string };

// ───────────────────────── Coach Access Pass ─────────────────────────

export async function activePass(userId: string) {
  return prisma.coachAccessPass.findFirst({ where: { userId, startsAt: { lte: new Date() }, endsAt: { gt: new Date() } }, orderBy: { endsAt: 'desc' } });
}

export async function passStatus(userId: string): Promise<CoachPassStatus> {
  const cfg = await getConfig(CONFIG_KEYS.coachPass);
  // includes a renewal queued after the current one
  const latest = await prisma.coachAccessPass.findFirst({ where: { userId, endsAt: { gt: new Date() } }, orderBy: { endsAt: 'desc' } });
  const active = !!(await activePass(userId));
  return { active, endsAt: latest?.endsAt.toISOString() ?? null, priceRwf: cfg.priceRwf, days: cfg.days };
}

export async function buyPass(member: Member, idempotencyKey: string) {
  const cfg = await getConfig(CONFIG_KEYS.coachPass);
  const passId = crypto.randomUUID(); // the pass row is created only once payment is verified
  return startOnlinePayment({
    user: member,
    purpose: 'COACH_PASS',
    amountRwf: cfg.priceRwf,
    idempotencyKey,
    fingerprint: 'coach-pass',
    meta: { days: cfg.days, passId },
    description: `DIVE-IN Coach Access Pass · ${cfg.days} days`,
    returnPath: '/app/checkout/return',
    prepare: async () => passId,
  });
}

// ───────────────────────── coach profiles ─────────────────────────

const PUBLIC_TRAINER: Prisma.TrainerWhereInput = { verificationStatus: 'VERIFIED', user: { status: 'ACTIVE' } };

/** Free profile for everyone; bio, fee, credentials and live availability only with an active pass. */
export async function coachProfile(trainerId: string, viewer?: { id: string; role: string }): Promise<CoachProfile> {
  const t = await prisma.trainer.findFirst({
    where: { id: trainerId, ...PUBLIC_TRAINER },
    include: { user: { select: { fullName: true } }, gyms: { where: { gym: { status: 'APPROVED' } }, include: { gym: { select: { id: true, name: true, neighbourhood: true, slug: true } } } } },
  });
  if (!t) throw notFound('Coach not found');
  const base: CoachProfile = {
    id: t.id,
    fullName: t.user.fullName,
    photoUrl: t.photoUrl,
    headline: t.headline,
    specialties: t.specialties,
    gyms: t.gyms.map((g) => g.gym),
    yearsExperience: t.yearsExperience,
    unlocked: false,
  };
  const unlocked = viewer?.role === 'MEMBER' && !!(await activePass(viewer.id));
  if (!unlocked) return base;
  const { slots, minutes } = await trainerSlots(t.id);
  return { ...base, unlocked: true, bio: t.bio, certifications: t.certifications, languages: t.languages, sessionFeeRwf: t.sessionFeeRwf, sessionMinutes: minutes, slots: t.sessionFeeRwf ? slots : [] };
}

// ───────────────────────── bookings ─────────────────────────

const bookingInclude = {
  trainer: { select: { id: true, photoUrl: true, user: { select: { fullName: true } } } },
  member: { select: { id: true, fullName: true, phone: true } },
} satisfies Prisma.BookingInclude;

export async function toBookingViews(rows: Prisma.BookingGetPayload<{ include: typeof bookingInclude }>[], forTrainer = false): Promise<BookingView[]> {
  const ids = rows.map((r) => r.id);
  const [payments, gyms] = await Promise.all([
    prisma.payment.findMany({ where: { purpose: 'SESSION', targetId: { in: ids } }, orderBy: { createdAt: 'desc' } }),
    prisma.gym.findMany({ where: { id: { in: rows.map((r) => r.gymId).filter(Boolean) as string[] } }, select: { id: true, name: true, neighbourhood: true } }),
  ]);
  const gymById = new Map(gyms.map((g) => [g.id, g]));
  return rows.map((b) => {
    const p = payments.find((x) => x.targetId === b.id);
    const open = p?.status === 'PENDING' && p.checkoutUrl && (!p.expiresAt || p.expiresAt > new Date());
    const g = b.gymId ? gymById.get(b.gymId) : null;
    return {
      id: b.id,
      status: b.status,
      startsAt: b.startsAt.toISOString(),
      endsAt: b.endsAt.toISOString(),
      feeRwf: b.feeRwf,
      note: b.note,
      cancelReason: b.cancelReason,
      trainer: { id: b.trainer.id, fullName: b.trainer.user.fullName, photoUrl: b.trainer.photoUrl },
      member: { id: b.member.id, fullName: b.member.fullName, ...(forTrainer ? { phone: b.member.phone } : {}) },
      gym: g ? { name: g.name, neighbourhood: g.neighbourhood } : null,
      payment: p ? { id: p.id, status: p.status, checkoutUrl: open ? p.checkoutUrl : null } : null,
      createdAt: b.createdAt.toISOString(),
    };
  });
}

export async function myBookings(memberId: string) {
  const rows = await prisma.booking.findMany({ where: { memberId, status: { not: 'EXPIRED' } }, include: bookingInclude, orderBy: { startsAt: 'desc' }, take: 100 });
  return toBookingViews(rows);
}

/**
 * Books a slot and opens checkout for the session fee (a separate payment from the pass).
 * The partial unique index on (trainer, startsAt) for live bookings makes double-booking impossible,
 * even when two members click at the same moment.
 */
export async function book(member: Member, trainerId: string, startsAtIso: string, note: string | undefined, idempotencyKey: string): Promise<BookingStarted> {
  if (!(await activePass(member.id))) throw forbidden('Get a Coach Access Pass to book sessions');
  const trainer = await prisma.trainer.findFirst({ where: { id: trainerId, ...PUBLIC_TRAINER }, include: { user: { select: { fullName: true } }, availability: true } });
  if (!trainer) throw notFound('Coach not found');
  if (!trainer.sessionFeeRwf) throw badRequest('This coach has not set a session fee yet');
  const fee = trainer.sessionFeeRwf;
  const startsAt = new Date(startsAtIso);
  const fingerprint = `session:${trainerId}:${startsAt.toISOString()}`;

  // Replays skip the availability check (the slot is held by this very booking).
  const existing = await prisma.payment.findUnique({ where: { userId_idempotencyKey: { userId: member.id, idempotencyKey } } });
  if (!existing) {
    const { slots } = await trainerSlots(trainerId);
    if (!slots.some((d) => d.times.includes(startsAt.toISOString()))) throw conflict('That time is no longer available. Pick another slot.');
  }
  const endsAt = new Date(startsAt.getTime() + trainer.sessionMinutes * 60_000);
  const weekday = new Date(startsAt.getTime() + 2 * 3600_000).getUTCDay();
  const gymId = trainer.availability.find((a) => a.weekday === weekday)?.gymId ?? null;

  try {
    const started = await startOnlinePayment({
      user: member,
      purpose: 'SESSION',
      amountRwf: fee,
      payeeShareRwf: fee, // the trainer's fee; DIVE-IN takes no cut of sessions in this model
      idempotencyKey,
      fingerprint,
      meta: { trainerId, startsAt: startsAt.toISOString() },
      description: `Coaching session with ${trainer.user.fullName}`,
      returnPath: '/app/checkout/return',
      prepare: async (tx) => {
        const b = await tx.booking.create({
          data: { memberId: member.id, trainerId, gymId, startsAt, endsAt, feeRwf: fee, note: note ?? null, holdExpiresAt: new Date(Date.now() + 40 * 60_000) },
        });
        return b.id;
      },
      onProviderFailure: async (bookingId) => {
        await prisma.booking.updateMany({ where: { id: bookingId, status: 'PENDING_PAYMENT' }, data: { status: 'EXPIRED' } });
      },
    });
    // Hold the slot exactly as long as the checkout link stays valid.
    const exp = await checkoutExpiry(started.paymentId);
    if (exp) await prisma.booking.updateMany({ where: { id: started.targetId, status: 'PENDING_PAYMENT' }, data: { holdExpiresAt: exp } });
    return { bookingId: started.targetId, paymentId: started.paymentId, redirectUrl: started.redirectUrl };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw conflict('Someone just booked that time. Pick another slot.');
    throw e;
  }
}

/** Members can drop unpaid bookings any time, and paid ones up to 24 h before (refund handled by DIVE-IN). */
export async function cancelMyBooking(memberId: string, id: string, reason?: string) {
  const b = await prisma.booking.findFirst({ where: { id, memberId }, include: { trainer: { select: { userId: true } }, member: { select: { fullName: true } } } });
  if (!b) throw notFound('Booking not found');
  if (b.status === 'PENDING_PAYMENT') {
    await cancelOpenPaymentsFor('SESSION', b.id, 'Booking cancelled by member');
    await prisma.booking.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: memberId, cancelReason: reason ?? null } });
    return;
  }
  if (b.status !== 'CONFIRMED') throw badRequest('This booking can no longer be cancelled');
  if (b.startsAt.getTime() - Date.now() < 24 * 3600_000) throw badRequest('Paid sessions can be cancelled up to 24 hours before. Contact your coach.');
  await prisma.$transaction(async (tx) => {
    await tx.booking.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: memberId, cancelReason: reason ?? null } });
    await tx.payment.updateMany({ where: { purpose: 'SESSION', targetId: id, status: 'PAID' }, data: { failureReason: 'NEEDS_REVIEW: refund due — member cancelled 24h+ ahead' } });
    await audit({ actorId: memberId, actorRole: 'MEMBER', action: 'booking.cancelled', entity: 'booking', entityId: id, after: { reason, refundDue: true } }, tx);
    await notify(b.trainer.userId, { type: 'booking.cancelled', title: `${b.member.fullName} cancelled a session`, body: reason ?? undefined, link: '/trainer/sessions' }, tx);
  });
}

// ───────────────────────── messaging ─────────────────────────

async function participant(conversationId: string, user: { id: string; role: string }) {
  const c = await prisma.conversation.findUnique({ where: { id: conversationId }, include: { trainer: { select: { userId: true } } } });
  if (!c) throw notFound('Conversation not found');
  const isMember = c.memberId === user.id;
  const isTrainer = c.trainer.userId === user.id;
  if (!isMember && !isTrainer) throw notFound('Conversation not found');
  return { c, isMember };
}

async function addMessage(conversationId: string, senderId: string, recipientId: string, body: string, title: string, link: string) {
  // Notify only on the first unread message, not for every line typed.
  const unreadBefore = await prisma.message.count({ where: { conversationId, senderId, readAt: null } });
  const m = await prisma.message.create({ data: { conversationId, senderId, body } });
  await prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: m.createdAt } });
  if (unreadBefore === 0) await notify(recipientId, { type: 'message.new', title, body: body.slice(0, 120), link });
  return m;
}

export async function startConversation(member: Member, trainerId: string, body: string) {
  if (!(await activePass(member.id))) throw forbidden('Get a Coach Access Pass to message coaches');
  const t = await prisma.trainer.findFirst({ where: { id: trainerId, ...PUBLIC_TRAINER }, include: { user: { select: { id: true } } } });
  if (!t) throw notFound('Coach not found');
  const c = await prisma.conversation.upsert({ where: { memberId_trainerId: { memberId: member.id, trainerId } }, create: { memberId: member.id, trainerId }, update: {} });
  const me = await prisma.user.findUniqueOrThrow({ where: { id: member.id }, select: { fullName: true } });
  await addMessage(c.id, member.id, t.user.id, body, `Message from ${me.fullName}`, `/trainer/messages?c=${c.id}`);
  return c.id;
}

export async function sendMessage(user: { id: string; role: string }, conversationId: string, body: string) {
  const { c, isMember } = await participant(conversationId, user);
  if (isMember && !(await activePass(user.id))) throw forbidden('Your Coach Access Pass has ended. Renew it to keep messaging.');
  const sender = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { fullName: true } });
  const recipient = isMember ? c.trainer.userId : c.memberId;
  const m = await addMessage(c.id, user.id, recipient, body, `Message from ${sender.fullName}`, isMember ? `/trainer/messages?c=${c.id}` : `/app/messages?c=${c.id}`);
  return { id: m.id, body: m.body, fromMe: true, createdAt: m.createdAt.toISOString(), readAt: null } satisfies MessageView;
}

export async function conversations(user: { id: string; role: string }): Promise<ConversationView[]> {
  const trainer = user.role === 'TRAINER' ? await prisma.trainer.findUnique({ where: { userId: user.id }, select: { id: true } }) : null;
  const rows = await prisma.conversation.findMany({
    where: user.role === 'TRAINER' ? { trainerId: trainer?.id ?? '00000000-0000-0000-0000-000000000000' } : { memberId: user.id },
    include: {
      member: { select: { id: true, fullName: true } },
      trainer: { select: { id: true, photoUrl: true, user: { select: { fullName: true } } } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { lastMessageAt: 'desc' },
    take: 100,
  });
  const unread = await prisma.message.groupBy({ by: ['conversationId'], where: { conversationId: { in: rows.map((r) => r.id) }, senderId: { not: user.id }, readAt: null }, _count: true });
  const unreadBy = new Map(unread.map((u) => [u.conversationId, u._count]));
  return rows.map((c) => {
    const last = c.messages[0];
    const other = user.role === 'TRAINER' ? { id: c.member.id, fullName: c.member.fullName, photoUrl: null } : { id: c.trainer.id, fullName: c.trainer.user.fullName, photoUrl: c.trainer.photoUrl };
    return {
      id: c.id,
      other,
      lastMessage: last ? { body: last.body, fromMe: last.senderId === user.id, createdAt: last.createdAt.toISOString() } : null,
      unread: unreadBy.get(c.id) ?? 0,
      lastMessageAt: c.lastMessageAt.toISOString(),
    };
  });
}

export async function thread(user: { id: string; role: string }, conversationId: string) {
  await participant(conversationId, user);
  await prisma.message.updateMany({ where: { conversationId, senderId: { not: user.id }, readAt: null }, data: { readAt: new Date() } });
  const rows = await prisma.message.findMany({ where: { conversationId }, orderBy: { createdAt: 'desc' }, take: 200 });
  return rows.reverse().map((m) => ({ id: m.id, body: m.body, fromMe: m.senderId === user.id, createdAt: m.createdAt.toISOString(), readAt: m.readAt?.toISOString() ?? null }) satisfies MessageView);
}

export { formatRwf };
