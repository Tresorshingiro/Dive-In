import type { Prisma } from '@prisma/client';
import { formatMembershipNumber, type CheckInOutcome, type CheckInView, type ReceptionResult } from '@dive/shared';
import { prisma } from '../../lib/prisma';
import { audit } from '../../lib/audit';
import { notFound } from '../../lib/errors';
import { kigaliDayStart } from '../../lib/time';
import { effectiveStatus } from '../memberships/memberships.service';

/** A second "check in" for the same member within this window returns the first one (double tap). */
const DUPLICATE_WINDOW_MS = 2 * 60 * 1000;

/** "DV-0000-0012", "dv00000012", "0012", "12" → 12. Returns null for name searches. */
export function parseMembershipNumber(q: string): number | null {
  const s = q.trim().toUpperCase().replace(/^DV/, '').replace(/[\s-]/g, '');
  if (!/^\d{1,8}$/.test(s)) return null;
  const n = Number(s);
  return n > 0 ? n : null;
}

function longDate(d: Date) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Kigali' });
}

/** The single rule for letting someone in: membership live and paid for, checked now, in the DB. */
export function entryDecision(m: { status: Parameters<typeof effectiveStatus>[0]['status']; endsAt: Date | null }, paymentVerified: boolean) {
  const status = effectiveStatus(m);
  if (status === 'ACTIVE' && paymentVerified) return { status, allowed: true, reason: null };
  if (status === 'ACTIVE') return { status, allowed: false, reason: 'Payment not verified' };
  if (status === 'AWAITING_PAYMENT') return { status, allowed: false, reason: 'Awaiting payment — not activated yet' };
  if (status === 'EXPIRED') return { status, allowed: false, reason: m.endsAt ? `Expired on ${longDate(m.endsAt)}` : 'Membership expired' };
  return { status, allowed: false, reason: 'Membership cancelled' };
}

export async function verifiedMembershipIds(ids: string[]) {
  if (!ids.length) return new Set<string>();
  const paid = await prisma.payment.findMany({ where: { purpose: 'MEMBERSHIP', status: 'PAID', targetId: { in: ids } }, select: { targetId: true }, distinct: ['targetId'] });
  return new Set(paid.map((p) => p.targetId));
}

export async function lastCheckIns(ids: string[]) {
  if (!ids.length) return new Map<string, Date>();
  const rows = await prisma.checkIn.groupBy({ by: ['membershipId'], where: { membershipId: { in: ids }, result: 'ALLOWED' }, _max: { createdAt: true } });
  return new Map(rows.map((r) => [r.membershipId, r._max.createdAt!]));
}

/** Search this gym's memberships by member name or membership number. Nothing financial or personal beyond the name. */
export async function search(gymId: string, q: string): Promise<ReceptionResult[]> {
  const number = parseMembershipNumber(q);
  const where: Prisma.MembershipWhereInput = number
    ? { gymId, number }
    : { gymId, member: { fullName: { contains: q, mode: 'insensitive' } } };
  const rows = await prisma.membership.findMany({
    where,
    take: 20,
    orderBy: [{ updatedAt: 'desc' }],
    include: { member: { select: { fullName: true } }, package: { select: { name: true } } },
  });
  const ids = rows.map((r) => r.id);
  const [verified, last] = await Promise.all([verifiedMembershipIds(ids), lastCheckIns(ids)]);
  const today = kigaliDayStart();
  const order = { ACTIVE: 0, AWAITING_PAYMENT: 1, EXPIRED: 2, CANCELLED: 3 } as const;

  return rows
    .map((m) => {
      const d = entryDecision(m, verified.has(m.id));
      const lastAt = last.get(m.id) ?? null;
      return {
        membershipId: m.id,
        number: formatMembershipNumber(m.number),
        memberName: m.member.fullName,
        packageName: m.package.name,
        status: d.status,
        endsAt: m.endsAt?.toISOString() ?? null,
        paymentVerified: verified.has(m.id),
        entryAllowed: d.allowed,
        reason: d.reason,
        lastCheckInAt: lastAt?.toISOString() ?? null,
        checkedInToday: !!lastAt && lastAt >= today,
      };
    })
    .sort((a, b) => order[a.status] - order[b.status]);
}

const checkInInclude = {
  membership: { select: { number: true, member: { select: { fullName: true } } } },
  staff: { select: { fullName: true } },
} satisfies Prisma.CheckInInclude;

export function toCheckInView(c: Prisma.CheckInGetPayload<{ include: typeof checkInInclude }>): CheckInView {
  return {
    id: c.id,
    memberName: c.membership.member.fullName,
    number: formatMembershipNumber(c.membership.number),
    result: c.result,
    reason: c.reason,
    staffName: c.staff.fullName,
    createdAt: c.createdAt.toISOString(),
  };
}

/**
 * Records an entry attempt. The decision is re-made here from the live record — whatever the
 * desk screen showed a minute ago doesn't matter. Denied attempts are logged too.
 */
export async function checkIn(gymId: string, staff: { id: string; role: 'GYM_OWNER' | 'RECEPTIONIST' | string }, membershipId: string, ip?: string | null): Promise<CheckInOutcome> {
  const m = await prisma.membership.findFirst({ where: { id: membershipId, gymId } });
  if (!m) throw notFound('Membership not found at this gym');

  const verified = (await verifiedMembershipIds([m.id])).has(m.id);
  const d = entryDecision(m, verified);

  // Serialise taps for the same membership so two simultaneous taps can't both pass the duplicate check.
  const { c, recent } = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${m.id}))`;
    if (d.allowed) {
      const recent = await tx.checkIn.findFirst({
        where: { membershipId: m.id, result: 'ALLOWED', createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) } },
        include: checkInInclude,
        orderBy: { createdAt: 'desc' },
      });
      if (recent) return { c: null, recent };
    }
    const c = await tx.checkIn.create({
      data: { membershipId: m.id, gymId, staffId: staff.id, result: d.allowed ? 'ALLOWED' : 'DENIED', reason: d.reason },
      include: checkInInclude,
    });
    return { c, recent: null };
  });
  if (recent) return { checkIn: toCheckInView(recent), duplicate: true };
  if (!c) throw new Error('unreachable');
  await audit({ actorId: staff.id, actorRole: staff.role as never, action: d.allowed ? 'checkin.allowed' : 'checkin.denied', entity: 'membership', entityId: m.id, gymId, after: { reason: d.reason }, ip });
  return { checkIn: toCheckInView(c), duplicate: false };
}

export async function recentCheckIns(gymId: string, since?: Date, take = 30) {
  const rows = await prisma.checkIn.findMany({
    where: { gymId, ...(since ? { createdAt: { gte: since } } : {}) },
    include: checkInInclude,
    orderBy: { createdAt: 'desc' },
    take,
  });
  return rows.map(toCheckInView);
}
