import crypto from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import type { z } from 'zod';
import type { availabilitySchema, trainerProfileSchema, TrainerOverview, TrainerSelf } from '@dive/shared';
import { prisma } from '../../lib/prisma';
import { audit } from '../../lib/audit';
import { notify } from '../../lib/notify';
import { badRequest, notFound } from '../../lib/errors';
import { kigaliMonthStart } from '../../lib/time';
import { UPLOAD_ROOT } from '../gym/photos.service';
import { toBookingViews } from './coaching.service';

export async function trainerFor(userId: string) {
  const t = await prisma.trainer.findUnique({ where: { userId } });
  if (!t) throw notFound('Trainer profile not found');
  return t;
}

export async function self(userId: string): Promise<TrainerSelf> {
  const t = await prisma.trainer.findUniqueOrThrow({
    where: { userId },
    include: { user: { select: { fullName: true, email: true } }, gyms: { include: { gym: { select: { id: true, name: true, neighbourhood: true } } } } },
  });
  return {
    id: t.id,
    fullName: t.user.fullName,
    email: t.user.email,
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
    gyms: t.gyms.map((g) => g.gym),
  };
}

export async function updateProfile(userId: string, input: z.output<typeof trainerProfileSchema>) {
  const t = await trainerFor(userId);
  await prisma.trainer.update({ where: { id: t.id }, data: input });
  if (t.sessionFeeRwf !== input.sessionFeeRwf) {
    await audit({ actorId: userId, actorRole: 'TRAINER', action: 'trainer.fee_changed', entity: 'trainer', entityId: t.id, before: { sessionFeeRwf: t.sessionFeeRwf }, after: { sessionFeeRwf: input.sessionFeeRwf } });
  }
  return self(userId);
}

/** Portrait photo, re-encoded (EXIF/GPS stripped) and cropped to 4:5. */
export async function setPhoto(userId: string, bytes: Buffer) {
  const t = await trainerFor(userId);
  let out: Buffer;
  try {
    const meta = await sharp(bytes).metadata();
    if (!meta.width || !['jpeg', 'png', 'webp'].includes(meta.format ?? '')) throw new Error('format');
    if (meta.width < 400) throw badRequest('Photo is too small — use one at least 400 px wide');
    out = await sharp(bytes).rotate().resize(800, 1000, { fit: 'cover', position: sharp.strategy.attention }).webp({ quality: 80 }).toBuffer();
  } catch (e) {
    if (e instanceof Error && 'status' in e) throw e;
    throw badRequest('That file is not a JPEG, PNG or WebP image');
  }
  const dir = path.join(UPLOAD_ROOT, 'trainers', t.id);
  await mkdir(dir, { recursive: true });
  const name = `${crypto.randomUUID()}.webp`;
  await writeFile(path.join(dir, name), out);
  const url = `/uploads/trainers/${t.id}/${name}`;
  await prisma.trainer.update({ where: { id: t.id }, data: { photoUrl: url } });
  if (t.photoUrl?.startsWith(`/uploads/trainers/${t.id}/`)) await unlink(path.join(dir, path.basename(t.photoUrl))).catch(() => undefined);
  return url;
}

// ───────────────────────── availability ─────────────────────────

export async function getAvailability(userId: string) {
  const t = await trainerFor(userId);
  const [slots, exceptions] = await Promise.all([
    prisma.trainerAvailability.findMany({ where: { trainerId: t.id }, orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }] }),
    prisma.availabilityException.findMany({ where: { trainerId: t.id, date: { gte: new Date(new Date().toISOString().slice(0, 10)) } }, orderBy: { date: 'asc' } }),
  ]);
  return {
    sessionMinutes: t.sessionMinutes,
    slots: slots.map((s) => ({ id: s.id, weekday: s.weekday, startTime: s.startTime, endTime: s.endTime, gymId: s.gymId })),
    exceptions: exceptions.map((e) => ({ id: e.id, date: e.date.toISOString().slice(0, 10), note: e.note })),
  };
}

/** Replaces the weekly schedule. Rejects overlapping windows and gyms the trainer isn't linked to. */
export async function setAvailability(userId: string, input: z.output<typeof availabilitySchema>) {
  const t = await trainerFor(userId);
  const linked = new Set((await prisma.trainerGym.findMany({ where: { trainerId: t.id }, select: { gymId: true } })).map((g) => g.gymId));
  for (const s of input.slots) if (s.gymId && !linked.has(s.gymId)) throw badRequest('One of the gyms is not linked to your profile');
  for (let d = 0; d < 7; d++) {
    const day = input.slots.filter((s) => s.weekday === d).sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (let i = 1; i < day.length; i++) if (day[i].startTime < day[i - 1].endTime) throw badRequest('Two time windows on the same day overlap');
  }
  await prisma.$transaction([
    prisma.trainerAvailability.deleteMany({ where: { trainerId: t.id } }),
    prisma.trainerAvailability.createMany({ data: input.slots.map((s) => ({ ...s, trainerId: t.id })) }),
  ]);
  return getAvailability(userId);
}

export async function addDayOff(userId: string, date: string, note?: string) {
  const t = await trainerFor(userId);
  const d = new Date(`${date}T00:00:00Z`);
  if (d.getTime() < Date.now() - 24 * 3600_000) throw badRequest('Pick today or a future date');
  const exists = await prisma.availabilityException.findFirst({ where: { trainerId: t.id, date: d } });
  if (!exists) await prisma.availabilityException.create({ data: { trainerId: t.id, date: d, available: false, note: note ?? null } });
  return getAvailability(userId);
}

export async function removeDayOff(userId: string, id: string) {
  const t = await trainerFor(userId);
  await prisma.availabilityException.deleteMany({ where: { id, trainerId: t.id } });
  return getAvailability(userId);
}

// ───────────────────────── sessions ─────────────────────────

const include = {
  trainer: { select: { id: true, photoUrl: true, user: { select: { fullName: true } } } },
  member: { select: { id: true, fullName: true, phone: true } },
} as const;

export async function sessions(userId: string, scope: 'upcoming' | 'past') {
  const t = await trainerFor(userId);
  const now = new Date();
  const rows = await prisma.booking.findMany({
    where: scope === 'upcoming' ? { trainerId: t.id, status: 'CONFIRMED', endsAt: { gte: now } } : { trainerId: t.id, OR: [{ status: { in: ['COMPLETED', 'CANCELLED'] } }, { status: 'CONFIRMED', endsAt: { lt: now } }] },
    include,
    orderBy: { startsAt: scope === 'upcoming' ? 'asc' : 'desc' },
    take: 100,
  });
  return toBookingViews(rows, true);
}

export async function completeSession(userId: string, id: string) {
  const t = await trainerFor(userId);
  const b = await prisma.booking.findFirst({ where: { id, trainerId: t.id } });
  if (!b) throw notFound('Session not found');
  if (b.status !== 'CONFIRMED' || b.startsAt > new Date()) throw badRequest('Only confirmed sessions that have started can be marked done');
  await prisma.booking.update({ where: { id }, data: { status: 'COMPLETED', completedAt: new Date() } });
  await audit({ actorId: userId, actorRole: 'TRAINER', action: 'booking.completed', entity: 'booking', entityId: id });
}

/** Trainer cancels a confirmed future session: the member is notified and DIVE-IN refunds them. */
export async function cancelSession(userId: string, id: string, reason?: string) {
  const t = await trainerFor(userId);
  const b = await prisma.booking.findFirst({ where: { id, trainerId: t.id }, include: { trainer: { select: { user: { select: { fullName: true } } } } } });
  if (!b) throw notFound('Session not found');
  if (b.status !== 'CONFIRMED' || b.startsAt < new Date()) throw badRequest('Only upcoming confirmed sessions can be cancelled');
  await prisma.$transaction(async (tx) => {
    await tx.booking.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: userId, cancelReason: reason ?? null } });
    await tx.payment.updateMany({ where: { purpose: 'SESSION', targetId: id, status: 'PAID' }, data: { failureReason: 'NEEDS_REVIEW: refund due — trainer cancelled' } });
    await audit({ actorId: userId, actorRole: 'TRAINER', action: 'booking.cancelled_by_trainer', entity: 'booking', entityId: id, after: { reason } }, tx);
    await notify(b.memberId, { type: 'booking.cancelled', title: `${b.trainer.user.fullName} cancelled your session`, body: `${reason ? `${reason}. ` : ''}You'll get a full refund.`, link: '/app/coaching' }, tx);
  });
}

export async function overview(userId: string): Promise<TrainerOverview> {
  const t = await trainerFor(userId);
  const missing: string[] = [];
  if (!t.headline) missing.push('headline');
  if (!t.bio) missing.push('bio');
  if (!t.photoUrl) missing.push('photo');
  if (!t.sessionFeeRwf) missing.push('session fee');
  if (!(await prisma.trainerAvailability.count({ where: { trainerId: t.id } }))) missing.push('availability');
  const month = kigaliMonthStart();
  const [upcoming, done, earned, unread] = await Promise.all([
    sessions(userId, 'upcoming'),
    prisma.booking.count({ where: { trainerId: t.id, status: { in: ['CONFIRMED', 'COMPLETED'] }, startsAt: { gte: month, lte: new Date() } } }),
    prisma.$queryRaw<{ total: bigint | null }[]>`
      SELECT SUM(p.payee_share_rwf) AS total FROM payments p JOIN bookings b ON b.id = p.target_id
      WHERE p.purpose = 'SESSION' AND p.status = 'PAID' AND b.trainer_id = ${t.id}::uuid AND p.paid_at >= ${month}`,
    prisma.message.count({ where: { conversation: { trainerId: t.id }, senderId: { not: userId }, readAt: null } }),
  ]);
  return {
    verificationStatus: t.verificationStatus,
    profileComplete: missing.length === 0,
    missing,
    upcoming: upcoming.slice(0, 6),
    sessionsThisMonth: done,
    earnedThisMonthRwf: Number(earned[0]?.total ?? 0),
    unreadMessages: unread,
  };
}
