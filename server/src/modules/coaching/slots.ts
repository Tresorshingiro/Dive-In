import { prisma } from '../../lib/prisma';
import { DAY_MS } from '../../lib/time';

const OFFSET_MS = 2 * 60 * 60 * 1000; // Kigali = UTC+2
export const BOOKING_LEAD_MS = 2 * 60 * 60 * 1000; // book at least 2 h ahead
export const BOOKING_WINDOW_DAYS = 14;

/** Kigali calendar date (YYYY-MM-DD) and weekday (0 = Sunday) for an instant. */
export function kigaliDate(d: Date) {
  const local = new Date(d.getTime() + OFFSET_MS);
  return { iso: local.toISOString().slice(0, 10), weekday: local.getUTCDay(), y: local.getUTCFullYear(), m: local.getUTCMonth(), day: local.getUTCDate() };
}

/** "HH:MM" on a Kigali date → UTC instant. */
function at(y: number, m: number, day: number, hhmm: string) {
  const [h, min] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(y, m, day, h, min) - OFFSET_MS);
}

/**
 * Bookable start times for a trainer over the next 14 days:
 * weekly availability − days off − times already held by live bookings − anything < 2 h away.
 */
export async function trainerSlots(trainerId: string, now = new Date()) {
  const trainer = await prisma.trainer.findUniqueOrThrow({
    where: { id: trainerId },
    include: { availability: true, exceptions: { where: { date: { gte: new Date(now.getTime() - DAY_MS) } } } },
  });
  const minutes = trainer.sessionMinutes;
  const horizon = new Date(now.getTime() + (BOOKING_WINDOW_DAYS + 1) * DAY_MS);
  const busy = await prisma.booking.findMany({
    where: {
      trainerId,
      startsAt: { lt: horizon },
      endsAt: { gt: now },
      OR: [{ status: 'CONFIRMED' }, { status: 'PENDING_PAYMENT', holdExpiresAt: { gt: now } }],
    },
    select: { startsAt: true, endsAt: true },
  });
  const daysOff = new Set(trainer.exceptions.filter((e) => !e.available).map((e) => e.date.toISOString().slice(0, 10)));
  const earliest = now.getTime() + BOOKING_LEAD_MS;

  const out: { date: string; times: string[] }[] = [];
  for (let i = 0; i < BOOKING_WINDOW_DAYS; i++) {
    const d = kigaliDate(new Date(now.getTime() + i * DAY_MS));
    if (daysOff.has(d.iso)) continue;
    const times: string[] = [];
    for (const slot of trainer.availability.filter((a) => a.weekday === d.weekday).sort((a, b) => a.startTime.localeCompare(b.startTime))) {
      const end = at(d.y, d.m, d.day, slot.endTime).getTime();
      for (let s = at(d.y, d.m, d.day, slot.startTime).getTime(); s + minutes * 60_000 <= end; s += minutes * 60_000) {
        const e = s + minutes * 60_000;
        if (s < earliest) continue;
        if (busy.some((b) => s < b.endsAt.getTime() && e > b.startsAt.getTime())) continue;
        times.push(new Date(s).toISOString());
      }
    }
    if (times.length) out.push({ date: d.iso, times: [...new Set(times)].sort() });
  }
  return { slots: out, minutes };
}
