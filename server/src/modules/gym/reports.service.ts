import { Prisma } from '@prisma/client';
import { formatMembershipNumber, type ActivityRow, type GymPaymentRow, type GymReport } from '@dive/shared';
import { prisma } from '../../lib/prisma';
import { DAY_MS, kigaliDayStart, kigaliMonthStart } from '../../lib/time';

const KGL = Prisma.sql`'Africa/Kigali'`;

export async function report(gymId: string): Promise<GymReport> {
  const thisMonth = kigaliMonthStart(0);
  const lastMonth = kigaliMonthStart(1);
  const sixMonths = kigaliMonthStart(5);
  const thirtyDays = new Date(kigaliDayStart().getTime() - 29 * DAY_MS);
  const now = new Date();

  const [money] = await prisma.$queryRaw<
    { this_share: bigint | null; last_share: bigint | null; this_comm: bigint | null; this_dive: bigint | null; this_gym: bigint | null }[]
  >`
    SELECT
      SUM(p.payee_share_rwf) FILTER (WHERE p.paid_at >= ${thisMonth}) AS this_share,
      SUM(p.payee_share_rwf) FILTER (WHERE p.paid_at >= ${lastMonth} AND p.paid_at < ${thisMonth}) AS last_share,
      SUM(p.commission_rwf)  FILTER (WHERE p.paid_at >= ${thisMonth}) AS this_comm,
      SUM(p.amount_rwf)      FILTER (WHERE p.paid_at >= ${thisMonth} AND p.method <> 'PAID_AT_GYM') AS this_dive,
      SUM(p.amount_rwf)      FILTER (WHERE p.paid_at >= ${thisMonth} AND p.method = 'PAID_AT_GYM') AS this_gym
    FROM payments p JOIN memberships m ON m.id = p.target_id
    WHERE p.purpose = 'MEMBERSHIP' AND p.status = 'PAID' AND m.gym_id = ${gymId}::uuid AND p.paid_at >= ${lastMonth}`;

  const byDay = await prisma.$queryRaw<{ day: string; count: bigint }[]>`
    SELECT to_char((c.created_at AT TIME ZONE 'UTC') AT TIME ZONE ${KGL}, 'YYYY-MM-DD') AS day, COUNT(*) AS count
    FROM check_ins c
    WHERE c.gym_id = ${gymId}::uuid AND c.result = 'ALLOWED' AND c.created_at >= ${thirtyDays}
    GROUP BY 1`;

  const byMonth = await prisma.$queryRaw<{ month: string; share: bigint; comm: bigint }[]>`
    SELECT to_char((p.paid_at AT TIME ZONE 'UTC') AT TIME ZONE ${KGL}, 'YYYY-MM') AS month,
           SUM(p.payee_share_rwf) AS share, SUM(p.commission_rwf) AS comm
    FROM payments p JOIN memberships m ON m.id = p.target_id
    WHERE p.purpose = 'MEMBERSHIP' AND p.status = 'PAID' AND m.gym_id = ${gymId}::uuid AND p.paid_at >= ${sixMonths}
    GROUP BY 1`;

  const [active, awaiting, expired, checkIns30d] = await Promise.all([
    prisma.membership.count({ where: { gymId, status: 'ACTIVE', endsAt: { gt: now } } }),
    prisma.membership.count({ where: { gymId, status: 'AWAITING_PAYMENT' } }),
    prisma.membership.count({ where: { gymId, OR: [{ status: 'EXPIRED' }, { status: 'ACTIVE', endsAt: { lte: now } }] } }),
    prisma.checkIn.count({ where: { gymId, result: 'ALLOWED', createdAt: { gte: thirtyDays } } }),
  ]);

  // Fill gaps so charts get every day / month.
  const dayMap = new Map(byDay.map((r) => [r.day, Number(r.count)]));
  const checkInsByDay = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(thirtyDays.getTime() + i * DAY_MS + 2 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return { day: d, count: dayMap.get(d) ?? 0 };
  });
  const monthMap = new Map(byMonth.map((r) => [r.month, r]));
  const revenueByMonth = Array.from({ length: 6 }, (_, i) => {
    const key = new Date(kigaliMonthStart(5 - i).getTime() + 2 * 60 * 60 * 1000).toISOString().slice(0, 7);
    const r = monthMap.get(key);
    return { month: key, gymShareRwf: Number(r?.share ?? 0), commissionRwf: Number(r?.comm ?? 0) };
  });

  return {
    revenueThisMonthRwf: Number(money?.this_share ?? 0),
    revenueLastMonthRwf: Number(money?.last_share ?? 0),
    commissionThisMonthRwf: Number(money?.this_comm ?? 0),
    paidThroughDiveThisMonthRwf: Number(money?.this_dive ?? 0),
    paidAtGymThisMonthRwf: Number(money?.this_gym ?? 0),
    checkIns30d,
    members: { ACTIVE: active, AWAITING_PAYMENT: awaiting, EXPIRED: expired },
    checkInsByDay,
    revenueByMonth,
  };
}

export async function payments(gymId: string, opts: { from?: Date; take?: number } = {}): Promise<GymPaymentRow[]> {
  const memberships = await prisma.membership.findMany({ where: { gymId }, select: { id: true, number: true, member: { select: { fullName: true } }, package: { select: { name: true } } } });
  const byId = new Map(memberships.map((m) => [m.id, m]));
  const rows = await prisma.payment.findMany({
    where: { purpose: 'MEMBERSHIP', targetId: { in: [...byId.keys()] }, status: { in: ['PAID', 'REFUNDED', 'PENDING', 'FAILED'] }, ...(opts.from ? { createdAt: { gte: opts.from } } : {}) },
    orderBy: [{ paidAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    take: opts.take ?? 100,
  });
  const pkgIds = [...new Set(rows.map((p) => (p.meta as { packageId?: string } | null)?.packageId).filter(Boolean) as string[])];
  const pkgs = new Map((await prisma.package.findMany({ where: { id: { in: pkgIds } }, select: { id: true, name: true } })).map((p) => [p.id, p.name]));
  return rows.map((p) => {
    const m = byId.get(p.targetId)!;
    const pkgId = (p.meta as { packageId?: string } | null)?.packageId;
    return {
      id: p.id,
      paidAt: p.paidAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      memberName: m.member.fullName,
      number: formatMembershipNumber(m.number),
      packageName: (pkgId && pkgs.get(pkgId)) || m.package.name,
      method: p.method,
      status: p.status as GymPaymentRow['status'],
      amountRwf: p.amountRwf,
      commissionRwf: p.commissionRwf,
      gymShareRwf: p.payeeShareRwf,
    };
  });
}

const csvCell = (v: unknown) => {
  const s = String(v ?? '');
  // Quote, and neutralise spreadsheet formulas.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

export async function paymentsCsv(gymId: string) {
  const rows = (await payments(gymId, { from: kigaliMonthStart(11), take: 10000 })).filter((r) => r.status === 'PAID' || r.status === 'REFUNDED');
  const head = ['Paid at (Kigali)', 'Member', 'Membership no.', 'Package', 'Method', 'Status', 'Amount RWF', 'DIVE-IN commission RWF', 'Gym share RWF'];
  const lines = rows.map((r) =>
    [
      r.paidAt ? new Date(r.paidAt).toLocaleString('en-GB', { timeZone: 'Africa/Kigali' }) : '',
      r.memberName,
      r.number,
      r.packageName,
      r.method === 'PAID_AT_GYM' ? 'Paid at gym' : r.method === 'CARD' ? 'Card' : 'Mobile Money',
      r.status,
      r.amountRwf,
      r.commissionRwf,
      r.gymShareRwf,
    ]
      .map(csvCell)
      .join(','),
  );
  return [head.map(csvCell).join(','), ...lines].join('\r\n');
}

const SUMMARY: Record<string, string> = {
  'gym.apply': 'Applied to list the gym',
  'gym.profile_updated': 'Updated the gym profile',
  'gym.photo_added': 'Added a photo',
  'gym.photo_deleted': 'Deleted a photo',
  'package.created': 'Created a package',
  'package.updated': 'Edited a package',
  'package.price_changed': 'Changed a package price',
  'package.deleted': 'Deleted a package',
  'payment.recorded_at_gym': 'Recorded a payment at the desk',
  'membership.cancelled_by_gym': 'Cancelled a membership',
  'membership.requested_at_gym': 'Member requested to join (pay at gym)',
  'membership.activated': 'Membership activated after online payment',
  'membership.renewed': 'Membership renewed online',
  'checkin.denied': 'Entry denied at reception',
  'staff.created': 'Created a staff account',
  'staff.deactivated': 'Deactivated a staff account',
  'staff.reactivated': 'Reactivated a staff account',
  'staff.password_reset': 'Reset a staff password',
  'trainer.linked': 'Linked a trainer',
  'trainer.unlinked': 'Removed a trainer',
  'payment.checkout_started': 'Member started an online checkout',
};

/** The gym's audit trail (allowed check-ins are left out; they're in the check-in log). */
export async function activity(gymId: string): Promise<ActivityRow[]> {
  const rows = await prisma.auditLog.findMany({
    where: { gymId, action: { notIn: ['checkin.allowed', 'payment.checkout_started'] } },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { actor: { select: { fullName: true } } },
  });
  return rows.map((r) => {
    const after = (r.after ?? {}) as Record<string, unknown>;
    const before = (r.before ?? {}) as Record<string, unknown>;
    let summary = SUMMARY[r.action] ?? r.action;
    if (r.action === 'package.price_changed') summary = `Changed “${after.name}” from RWF ${Number(before.priceRwf).toLocaleString('en-US')} to RWF ${Number(after.priceRwf).toLocaleString('en-US')}`;
    if (r.action === 'package.created') summary = `Created package “${after.name}” at RWF ${Number(after.priceRwf).toLocaleString('en-US')}`;
    if (r.action === 'payment.recorded_at_gym') summary = `Recorded RWF ${Number(after.amountRwf).toLocaleString('en-US')} at the desk (${after.package})`;
    if (r.action === 'checkin.denied') summary = `Entry denied: ${after.reason ?? ''}`;
    if (r.action === 'staff.created') summary = `Created staff account for ${after.fullName}`;
    if (r.action === 'gym.profile_updated') summary = `Updated ${Object.keys(after).join(', ')}`;
    return { id: r.id, action: r.action, actorName: r.actor?.fullName ?? null, actorRole: r.actorRole, summary, createdAt: r.createdAt.toISOString() };
  });
}
