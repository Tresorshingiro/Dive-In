import { CONFIG_KEYS, type CoachPassConfig, type CommissionConfig, type GymPlansConfig } from '@dive/shared';

/** Defaults used when a key is missing (also what the seed writes). Prices are proposals, not final. */
export const CONFIG_DEFAULTS = {
  [CONFIG_KEYS.coachPass]: { priceRwf: 5000, days: 30 } satisfies CoachPassConfig,
  [CONFIG_KEYS.gymPlans]: {
    MONTHLY: { priceRwf: 30000, months: 1, label: 'Monthly' },
    QUARTERLY: { priceRwf: 85000, months: 3, label: '3 months' },
    SEMIANNUAL: { priceRwf: 160000, months: 6, label: '6 months' },
    ANNUAL: { priceRwf: 300000, months: 12, label: 'Annual' },
  } satisfies GymPlansConfig,
  [CONFIG_KEYS.commission]: { percent: 5 } satisfies CommissionConfig,
  [CONFIG_KEYS.trialDays]: 30,
};
