import { CONFIG_KEYS, type GymSubscriptionView } from '@dive/shared';
import { prisma } from '../../lib/prisma';
import { badRequest } from '../../lib/errors';
import { getConfig } from '../../lib/platformConfig';
import { DAY_MS } from '../../lib/time';
import { startOnlinePayment } from '../../lib/onlinePayment';

type Plan = 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL';

export async function view(gymId: string): Promise<GymSubscriptionView> {
  const now = new Date();
  const [plans, subs, pending] = await Promise.all([
    getConfig(CONFIG_KEYS.gymPlans),
    prisma.gymSubscription.findMany({ where: { gymId }, orderBy: { startsAt: 'desc' }, take: 24 }),
    prisma.payment.findFirst({ where: { purpose: 'GYM_SUBSCRIPTION', status: 'PENDING', meta: { path: ['gymId'], equals: gymId }, expiresAt: { gt: now } }, orderBy: { createdAt: 'desc' } }),
  ]);
  const live = subs.filter((s) => s.status === 'ACTIVE' && s.startsAt <= now && s.endsAt > now).sort((a, b) => b.endsAt.getTime() - a.endsAt.getTime())[0];
  const latestEnd = subs.filter((s) => s.status === 'ACTIVE').reduce<Date | null>((m, s) => (!m || s.endsAt > m ? s.endsAt : m), null);
  return {
    current: live ? { plan: live.plan, status: live.status, startsAt: live.startsAt.toISOString(), endsAt: (latestEnd ?? live.endsAt).toISOString(), daysLeft: Math.ceil(((latestEnd ?? live.endsAt).getTime() - now.getTime()) / DAY_MS) } : null,
    plans: Object.entries(plans).map(([id, p]) => ({ id, ...p })),
    history: subs.map((s) => ({ id: s.id, plan: s.plan, priceRwf: s.priceRwf, startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString() })),
    pendingPayment: pending ? { id: pending.id, checkoutUrl: pending.checkoutUrl } : null,
  };
}

export async function checkout(gymId: string, owner: { id: string; email: string }, plan: Plan, idempotencyKey: string) {
  const gym = await prisma.gym.findUniqueOrThrow({ where: { id: gymId }, select: { name: true, status: true } });
  if (gym.status !== 'APPROVED') throw badRequest('Your gym must be approved before choosing a partner plan');
  const p = (await getConfig(CONFIG_KEYS.gymPlans))[plan];
  return startOnlinePayment({
    user: { ...owner, role: 'GYM_OWNER' },
    purpose: 'GYM_SUBSCRIPTION',
    amountRwf: p.priceRwf,
    idempotencyKey,
    fingerprint: `subscription:${gymId}:${plan}`,
    meta: { gymId, plan, months: p.months },
    description: `DIVE-IN partner plan · ${p.label} · ${gym.name}`,
    returnPath: '/gym/subscription',
    gymId,
    prepare: async () => gymId,
  });
}
