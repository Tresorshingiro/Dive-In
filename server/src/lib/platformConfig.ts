import { CONFIG_KEYS, type PublicConfig } from '@dive/shared';
import { prisma } from './prisma';
import { CONFIG_DEFAULTS } from './configDefaults';

export { CONFIG_DEFAULTS };

type Defaults = typeof CONFIG_DEFAULTS;

export async function getConfig<K extends keyof Defaults>(key: K): Promise<Defaults[K]> {
  const row = await prisma.platformConfig.findUnique({ where: { key } });
  return (row?.value as Defaults[K] | undefined) ?? CONFIG_DEFAULTS[key];
}

export async function getPublicConfig(): Promise<PublicConfig> {
  const [coachPass, plans, commission, trialDays] = await Promise.all([
    getConfig(CONFIG_KEYS.coachPass),
    getConfig(CONFIG_KEYS.gymPlans),
    getConfig(CONFIG_KEYS.commission),
    getConfig(CONFIG_KEYS.trialDays),
  ]);
  return {
    coachPass,
    gymPlans: Object.entries(plans).map(([id, p]) => ({ id, ...p })),
    trialDays,
    commissionPercent: commission.percent,
  };
}
