export interface CoachPassStatus {
  active: boolean;
  endsAt: string | null;
  priceRwf: number;
  days: number;
}

/** Free profile (everyone) + full profile fields (only with an active Coach Access Pass). */
export interface CoachProfile {
  id: string;
  fullName: string;
  photoUrl: string | null;
  headline: string | null;
  specialties: string[];
  gyms: { id: string; name: string; neighbourhood: string; slug: string }[];
  yearsExperience: number | null;
  /** false = the fields below are withheld by the server */
  unlocked: boolean;
  bio?: string | null;
  certifications?: string[];
  languages?: string[];
  sessionFeeRwf?: number | null;
  sessionMinutes?: number;
  /** next 14 days of bookable start times (ISO), grouped by Kigali date */
  slots?: { date: string; times: string[] }[];
}

export type BookingStatusView = 'PENDING_PAYMENT' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';

export interface BookingView {
  id: string;
  status: BookingStatusView;
  startsAt: string;
  endsAt: string;
  feeRwf: number;
  note: string | null;
  cancelReason: string | null;
  trainer: { id: string; fullName: string; photoUrl: string | null };
  member: { id: string; fullName: string; phone?: string | null };
  gym: { name: string; neighbourhood: string } | null;
  payment: { id: string; status: string; checkoutUrl: string | null } | null;
  createdAt: string;
}

export interface BookingStarted {
  bookingId: string;
  paymentId: string;
  redirectUrl: string;
}

export interface ConversationView {
  id: string;
  other: { id: string; fullName: string; photoUrl: string | null };
  lastMessage: { body: string; fromMe: boolean; createdAt: string } | null;
  unread: number;
  lastMessageAt: string;
}

export interface MessageView {
  id: string;
  body: string;
  fromMe: boolean;
  createdAt: string;
  readAt: string | null;
}

export interface TrainerSelf {
  id: string;
  fullName: string;
  email: string;
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
  gyms: { id: string; name: string; neighbourhood: string }[];
}

export interface TrainerOverview {
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  profileComplete: boolean;
  missing: string[];
  upcoming: BookingView[];
  sessionsThisMonth: number;
  earnedThisMonthRwf: number;
  unreadMessages: number;
}
