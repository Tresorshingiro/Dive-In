import { z } from 'zod';
import { ROLES } from './constants';

export const totpCodeSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code from your app') });

export const statusNoteSchema = z.object({ note: z.string().trim().max(300).optional() });

export const adminCreateSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
});

export const userListQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  role: z.enum(ROLES).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export const auditQuerySchema = z.object({
  action: z.string().trim().max(60).optional(),
  actor: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export const paymentListQuerySchema = z.object({
  status: z.enum(['PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED', 'REVIEW']).optional(),
  purpose: z.enum(['MEMBERSHIP', 'COACH_PASS', 'SESSION', 'GYM_SUBSCRIPTION']).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

const plan = z.object({ priceRwf: z.coerce.number().int().min(0).max(10_000_000), months: z.number().int(), label: z.string() });

export const platformConfigSchema = z.object({
  coachPass: z.object({ priceRwf: z.coerce.number().int().min(500).max(1_000_000), days: z.coerce.number().int().min(1).max(365) }),
  gymPlans: z.object({ MONTHLY: plan, QUARTERLY: plan, SEMIANNUAL: plan, ANNUAL: plan }),
  commissionPercent: z.coerce.number().min(0).max(30),
  trialDays: z.coerce.number().int().min(0).max(180),
});
export type PlatformConfigInput = z.input<typeof platformConfigSchema>;

export const subscriptionCheckoutSchema = z.object({ plan: z.enum(['MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL']) });

export interface AdminOverview {
  users: Record<string, number>;
  gyms: { PENDING: number; APPROVED: number; REJECTED: number; SUSPENDED: number };
  trainersPending: number;
  activeMemberships: number;
  checkInsToday: number;
  bookingsUpcoming: number;
  contactUnhandled: number;
  paymentsNeedingReview: number;
  /** DIVE-IN's own revenue this month, by stream */
  revenueThisMonth: { commission: number; coachPass: number; subscriptions: number; total: number };
  /** money that moved through DIVE-IN checkout this month (incl. gym/trainer shares) */
  processedThisMonthRwf: number;
  revenueByMonth: { month: string; commission: number; coachPass: number; subscriptions: number }[];
  signupsByMonth: { month: string; members: number; gyms: number; trainers: number }[];
}

export interface AdminGymRow {
  id: string;
  name: string;
  slug: string;
  neighbourhood: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  statusNote: string | null;
  owner: { id: string; fullName: string; email: string; phone: string | null };
  createdAt: string;
  approvedAt: string | null;
  activeMembers: number;
  packages: number;
  photos: number;
  diveCheckoutEnabled: boolean;
  commissionOptIn: boolean;
  subscription: { plan: string; endsAt: string } | null;
}

export interface AdminTrainerRow {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  headline: string | null;
  specialties: string[];
  certifications: string[];
  yearsExperience: number | null;
  photoUrl: string | null;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  gyms: string[];
  createdAt: string;
}

export interface AdminUserRow {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: string;
  status: 'ACTIVE' | 'SUSPENDED';
  lastLoginAt: string | null;
  createdAt: string;
  mfaEnabled: boolean;
}

export interface AdminPaymentRow {
  id: string;
  purpose: string;
  status: string;
  method: string;
  provider: string;
  amountRwf: number;
  commissionRwf: number;
  userName: string;
  userEmail: string;
  description: string;
  failureReason: string | null;
  needsReview: boolean;
  createdAt: string;
  paidAt: string | null;
}

export interface AuditRow {
  id: string;
  action: string;
  actorName: string | null;
  actorRole: string | null;
  entity: string | null;
  entityId: string | null;
  gymName: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  createdAt: string;
}

export interface GymSubscriptionView {
  current: { plan: string; status: string; startsAt: string; endsAt: string; daysLeft: number } | null;
  plans: { id: string; label: string; priceRwf: number; months: number }[];
  history: { id: string; plan: string; priceRwf: number; startsAt: string; endsAt: string }[];
  pendingPayment: { id: string; checkoutUrl: string | null } | null;
}
