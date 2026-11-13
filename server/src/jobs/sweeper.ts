import { prisma } from '../lib/prisma';

/**
 * Housekeeping, every 10 minutes:
 * - ACTIVE memberships past their end date → EXPIRED (reads already treat them as expired).
 * - PENDING payments whose checkout link expired over 10 minutes ago → CANCELLED.
 *   (A late "paid" from the provider would still be recorded by applyVerified.)
 */
export async function sweep() {
  const now = new Date();
  const expired = await prisma.membership.updateMany({ where: { status: 'ACTIVE', endsAt: { lt: now } }, data: { status: 'EXPIRED' } });
  const stale = await prisma.payment.updateMany({
    where: { status: 'PENDING', expiresAt: { lt: new Date(now.getTime() - 10 * 60 * 1000) } },
    data: { status: 'CANCELLED', failureReason: 'Checkout expired before payment' },
  });
  // Unpaid booking holds release their slot (the partial unique index only covers live bookings).
  const holds = await prisma.booking.updateMany({ where: { status: 'PENDING_PAYMENT', holdExpiresAt: { lt: now } }, data: { status: 'EXPIRED' } });
  const ended = await prisma.gymSubscription.updateMany({ where: { status: 'ACTIVE', endsAt: { lt: now } }, data: { status: 'EXPIRED' } });
  if (expired.count || stale.count || holds.count || ended.count) {
    console.log(`sweeper: ${expired.count} memberships expired, ${stale.count} checkouts closed, ${holds.count} booking holds released, ${ended.count} subscriptions ended`);
  }
}

export function startSweeper() {
  const run = () => sweep().catch((e) => console.error('sweeper failed', e));
  void run();
  return setInterval(run, 5 * 60 * 1000);
}
