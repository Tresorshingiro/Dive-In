import type { MembershipStatus } from './constants';

export interface GymContext {
  id: string;
  name: string;
  slug: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  statusNote: string | null;
  /** "OWNER" sees everything; "RECEPTIONIST" only the reception desk. */
  as: 'OWNER' | 'RECEPTIONIST';
  subscription: { plan: string; endsAt: string; daysLeft: number } | null;
}

export interface GymOverview {
  activeMembers: number;
  awaitingPayment: number;
  expiringSoon: number;
  checkInsToday: number;
  /** owner only */
  revenueThisMonthRwf?: number;
  recentCheckIns: CheckInView[];
  pendingRequests: GymMemberRow[];
}

export interface GymMemberRow {
  membershipId: string;
  number: string;
  memberName: string;
  email?: string;
  phone?: string | null;
  packageName: string;
  packageId: string;
  status: MembershipStatus;
  priceRwf: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  paymentVerified: boolean;
  lastCheckInAt: string | null;
}

/** What reception sees: the live record, nothing financial. */
export interface ReceptionResult {
  membershipId: string;
  number: string;
  memberName: string;
  packageName: string;
  status: MembershipStatus;
  endsAt: string | null;
  paymentVerified: boolean;
  /** Entry is allowed only when ACTIVE and payment verified. */
  entryAllowed: boolean;
  reason: string | null;
  lastCheckInAt: string | null;
  checkedInToday: boolean;
}

export interface CheckInView {
  id: string;
  memberName: string;
  number: string;
  result: 'ALLOWED' | 'DENIED';
  reason: string | null;
  staffName: string;
  createdAt: string;
}

export interface CheckInOutcome {
  checkIn: CheckInView;
  /** true when the same member was already let in a moment ago (double tap) */
  duplicate: boolean;
}

export interface GymPackageRow {
  id: string;
  name: string;
  description: string | null;
  durationDays: number;
  priceRwf: number;
  perks: string[];
  active: boolean;
  sortOrder: number;
  activeMembers: number;
}

export interface GymPhotoRow {
  id: string;
  url: string;
  caption: string | null;
  sortOrder: number;
}

export interface StaffRow {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  active: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface LinkedTrainerRow {
  trainerId: string;
  fullName: string;
  email: string;
  photoUrl: string | null;
  specialties: string[];
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  linkedAt: string;
}

export interface GymReport {
  revenueThisMonthRwf: number;
  revenueLastMonthRwf: number;
  commissionThisMonthRwf: number;
  paidThroughDiveThisMonthRwf: number;
  paidAtGymThisMonthRwf: number;
  checkIns30d: number;
  members: Record<'ACTIVE' | 'AWAITING_PAYMENT' | 'EXPIRED', number>;
  /** last 30 days, Kigali dates YYYY-MM-DD */
  checkInsByDay: { day: string; count: number }[];
  /** last 6 months, YYYY-MM */
  revenueByMonth: { month: string; gymShareRwf: number; commissionRwf: number }[];
}

export interface GymPaymentRow {
  id: string;
  paidAt: string | null;
  createdAt: string;
  memberName: string;
  number: string;
  packageName: string;
  method: 'MOMO' | 'CARD' | 'PAID_AT_GYM';
  status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
  amountRwf: number;
  commissionRwf: number;
  gymShareRwf: number;
}

export interface ActivityRow {
  id: string;
  action: string;
  actorName: string | null;
  actorRole: string | null;
  summary: string;
  createdAt: string;
}
