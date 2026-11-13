/** Shapes for the "open one item" detail pages across portals. */

export interface ActivityItem {
  id: string;
  action: string;
  actorName: string | null;
  actorRole: string | null;
  after: unknown;
  createdAt: string;
}

export interface AdminGymDetail {
  id: string;
  name: string;
  slug: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  statusNote: string | null;
  description: string | null;
  neighbourhood: string;
  address: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  email: string | null;
  openingHours: Record<string, string> | null;
  tags: string[];
  amenities: string[];
  diveCheckoutEnabled: boolean;
  commissionOptIn: boolean;
  createdAt: string;
  approvedAt: string | null;
  owner: { id: string; fullName: string; email: string; phone: string | null; createdAt: string; lastLoginAt: string | null };
  photos: { url: string; caption: string | null }[];
  packages: { id: string; name: string; durationDays: number; priceRwf: number; active: boolean; perks: string[] }[];
  staff: { id: string; userId: string; fullName: string; email: string; active: boolean; lastLoginAt: string | null }[];
  trainers: { id: string; fullName: string; verificationStatus: string; photoUrl: string | null }[];
  subscriptions: { id: string; plan: string; status: string; priceRwf: number; startsAt: string; endsAt: string }[];
  stats: { activeMembers: number; awaitingPayment: number; totalMembers: number; checkIns30d: number; revenue30dRwf: number; commission30dRwf: number };
  activity: ActivityItem[];
}

export interface AdminTrainerDetail {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  accountStatus: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  lastLoginAt: string | null;
  headline: string | null;
  bio: string | null;
  photoUrl: string | null;
  specialties: string[];
  certifications: string[];
  languages: string[];
  yearsExperience: number | null;
  sessionFeeRwf: number | null;
  sessionMinutes: number;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  verifiedAt: string | null;
  gyms: { id: string; name: string; neighbourhood: string; slug: string }[];
  availability: { weekday: number; startTime: string; endTime: string; gymName: string | null }[];
  stats: { upcoming: number; completed: number; cancelled: number; earnedRwf: number; conversations: number };
  recentBookings: { id: string; memberName: string; startsAt: string; status: string; feeRwf: number }[];
  activity: ActivityItem[];
}

export interface AdminUserDetail {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: string;
  status: 'ACTIVE' | 'SUSPENDED';
  mustChangePassword: boolean;
  mfaEnabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  ownedGyms: { id: string; name: string; status: string }[];
  staffOf: { gymId: string; gymName: string; active: boolean } | null;
  trainerId: string | null;
  memberships: { id: string; number: string; gymName: string; packageName: string; status: string; endsAt: string | null }[];
  coachPasses: { id: string; startsAt: string; endsAt: string; priceRwf: number }[];
  bookings: { id: string; trainerName: string; startsAt: string; status: string; feeRwf: number }[];
  payments: { id: string; description: string; amountRwf: number; status: string; method: string; createdAt: string }[];
  activity: ActivityItem[];
}

export interface AdminPaymentDetail {
  id: string;
  purpose: string;
  status: string;
  method: string;
  provider: string;
  providerRef: string | null;
  amountRwf: number;
  commissionRwf: number;
  payeeShareRwf: number;
  description: string;
  failureReason: string | null;
  idempotencyKey: string;
  createdAt: string;
  paidAt: string | null;
  verifiedAt: string | null;
  expiresAt: string | null;
  user: { id: string; fullName: string; email: string; phone: string | null };
  recordedBy: { id: string; fullName: string } | null;
  /** where the payment points: e.g. { kind: 'membership', label, link } */
  target: { kind: string; id: string; label: string; adminLink: string | null } | null;
  events: { id: string; eventId: string; type: string; processed: boolean; receivedAt: string }[];
  activity: ActivityItem[];
}

export interface GymTrainerDetail {
  trainerId: string;
  fullName: string;
  email: string;
  phone: string | null;
  photoUrl: string | null;
  headline: string | null;
  bio: string | null;
  specialties: string[];
  certifications: string[];
  languages: string[];
  yearsExperience: number | null;
  sessionFeeRwf: number | null;
  sessionMinutes: number;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  linkedAt: string;
  availabilityHere: { weekday: number; startTime: string; endTime: string }[];
  sessionsHere: { upcoming: number; completed: number };
}

export interface GymStaffDetail {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  active: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  stats: { checkInsToday: number; checkIns30d: number; refused30d: number };
  recentCheckIns: { id: string; memberName: string; number: string; result: 'ALLOWED' | 'DENIED'; reason: string | null; createdAt: string }[];
}

export interface SessionDetail {
  id: string;
  status: 'PENDING_PAYMENT' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
  startsAt: string;
  endsAt: string;
  feeRwf: number;
  note: string | null;
  cancelReason: string | null;
  createdAt: string;
  completedAt: string | null;
  gym: { name: string; neighbourhood: string; address: string | null; slug: string } | null;
  trainer: { id: string; fullName: string; photoUrl: string | null; headline: string | null; phone?: string | null };
  member: { id: string; fullName: string; phone?: string | null; email?: string };
  payment: { id: string; status: string; amountRwf: number; paidAt: string | null; checkoutUrl: string | null } | null;
  conversationId: string | null;
  /** trainer view: earlier sessions with this member */
  history: { id: string; startsAt: string; status: string }[];
}

export interface Receipt {
  id: string;
  purpose: string;
  status: string;
  description: string;
  amountRwf: number;
  method: string;
  provider: string;
  providerRef: string | null;
  createdAt: string;
  paidAt: string | null;
  failureReason: string | null;
  checkoutUrl: string | null;
  payer: { fullName: string; email: string };
  link: string | null;
}
