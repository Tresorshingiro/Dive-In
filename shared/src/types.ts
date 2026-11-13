import type { MembershipStatus, Role } from './constants';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: Role;
  /** Set for gym owners and receptionists. */
  gymId: string | null;
  /** Account was created with a temporary password; must set a new one before continuing. */
  mustChangePassword: boolean;
}

export interface GymSummary {
  id: string;
  slug: string;
  name: string;
  neighbourhood: string;
  tags: string[];
  lat: number;
  lng: number;
  coverUrl: string | null;
  fromPriceRwf: number | null;
  verified: boolean;
  distanceKm?: number;
}

export interface TrainerSummary {
  id: string;
  fullName: string;
  photoUrl: string | null;
  headline: string | null;
  specialties: string[];
  gyms: { name: string; neighbourhood: string }[];
  verified: boolean;
}

export interface PublicConfig {
  coachPass: { priceRwf: number; days: number };
  gymPlans: { id: string; label: string; priceRwf: number; months: number }[];
  trialDays: number;
  commissionPercent: number;
}

export interface PackageView {
  id: string;
  name: string;
  description: string | null;
  durationDays: number;
  priceRwf: number;
  perks: string[];
}

export interface GymProfile {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  neighbourhood: string;
  address: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  openingHours: Record<string, string> | null;
  tags: string[];
  amenities: string[];
  /** true: pay online through DIVE-IN. false: the gym collects payment at the front desk. */
  diveCheckoutEnabled: boolean;
  photos: { url: string; caption: string | null }[];
  packages: PackageView[];
  trainers: { id: string; fullName: string; photoUrl: string | null; headline: string | null; specialties: string[] }[];
}

export type PaymentStatusView = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED';

export interface PaymentView {
  id: string;
  purpose: 'MEMBERSHIP' | 'COACH_PASS' | 'SESSION' | 'GYM_SUBSCRIPTION';
  status: PaymentStatusView;
  amountRwf: number;
  method: 'MOMO' | 'CARD' | 'PAID_AT_GYM';
  provider: string;
  description: string;
  createdAt: string;
  paidAt: string | null;
  failureReason: string | null;
  /** For a pending online payment that can still be completed. */
  checkoutUrl: string | null;
  membershipId: string | null;
}

export interface MyMembership {
  id: string;
  number: string;
  status: MembershipStatus;
  gym: { id: string; slug: string; name: string; neighbourhood: string; diveCheckoutEnabled: boolean };
  package: { id: string; name: string; durationDays: number };
  priceRwf: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  /** The latest payment for this membership, if any. */
  lastPayment: { id: string; status: PaymentStatusView; checkoutUrl: string | null } | null;
}

export interface NotificationView {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface CheckoutStarted {
  paymentId: string;
  membershipId: string;
  redirectUrl: string;
}

export interface ApiError {
  error: { code: string; message: string; fields?: Record<string, string> };
}
