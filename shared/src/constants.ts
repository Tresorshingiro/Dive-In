/** Roles mirror the Prisma `Role` enum. */
export const ROLES = ['MEMBER', 'GYM_OWNER', 'RECEPTIONIST', 'TRAINER', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

/** Roles a visitor may pick on the public /register page. */
export const SELF_REGISTER_ROLES = ['MEMBER', 'GYM_OWNER', 'TRAINER'] as const;
export type SelfRegisterRole = (typeof SELF_REGISTER_ROLES)[number];

/** Where each role lands after login. */
export const ROLE_HOME: Record<Role, string> = {
  MEMBER: '/app',
  GYM_OWNER: '/gym',
  RECEPTIONIST: '/gym/reception',
  TRAINER: '/trainer',
  ADMIN: '/admin',
};

export const ROLE_LABEL: Record<Role, string> = {
  MEMBER: 'Member',
  GYM_OWNER: 'Gym owner',
  RECEPTIONIST: 'Receptionist',
  TRAINER: 'Trainer',
  ADMIN: 'DIVE-IN admin',
};

/** Kigali neighbourhoods. Stored as plain strings so new areas need no migration. */
export const NEIGHBOURHOODS = [
  'Kacyiru',
  'Kimihurura',
  'Remera',
  'Nyarutarama',
  'Kicukiro',
  'Gisozi',
  'Kiyovu',
  'Kimironko',
  'Kibagabaga',
  'Nyamirambo',
  'Gikondo',
] as const;
export type Neighbourhood = (typeof NEIGHBOURHOODS)[number];

/** Kigali city centre, used as the default map centre. */
export const KIGALI_CENTER = { lat: -1.9441, lng: 30.0619 } as const;

export const MEMBERSHIP_STATUSES = ['AWAITING_PAYMENT', 'ACTIVE', 'EXPIRED', 'CANCELLED'] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const CONTACT_ROLES = ['MEMBER', 'GYM_OWNER', 'TRAINER', 'OTHER'] as const;
export type ContactRole = (typeof CONTACT_ROLES)[number];

export const SUBSCRIPTION_PLANS = ['MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL'] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

/** Keys of the platform_config table. */
export const CONFIG_KEYS = {
  coachPass: 'coach_pass',
  gymPlans: 'gym_subscription_plans',
  commission: 'membership_commission',
  trialDays: 'gym_trial_days',
} as const;

export interface CoachPassConfig {
  priceRwf: number;
  days: number;
}
export type GymPlansConfig = Record<SubscriptionPlan, { priceRwf: number; months: number; label: string }>;
export interface CommissionConfig {
  percent: number;
}

/** Formats the numeric membership sequence as on the card, e.g. 123 -> "DV-0000-0123". */
export function formatMembershipNumber(n: number): string {
  const s = String(n).padStart(8, '0');
  return `DV-${s.slice(0, 4)}-${s.slice(4)}`;
}

export function formatRwf(amount: number): string {
  return `RWF ${amount.toLocaleString('en-US')}`;
}
