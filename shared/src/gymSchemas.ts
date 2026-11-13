import { z } from 'zod';
import { NEIGHBOURHOODS } from './constants';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

const HOURS = /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/;
export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/** "" = closed that day. */
const hoursValue = z
  .string()
  .trim()
  .refine((v) => v === '' || HOURS.test(v), 'Use HH:MM-HH:MM, e.g. 05:30-22:00')
  .refine((v) => v === '' || v.slice(0, 5) < v.slice(6), 'Closing time must be after opening time');

export const gymProfileSchema = z.object({
  name: z.string().trim().min(2, 'Enter the gym name').max(80),
  description: optionalText(1500),
  neighbourhood: z.enum(NEIGHBOURHOODS),
  address: optionalText(160),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, ''))
    .refine((v) => v === '' || /^(\+?250|0)7\d{8}$/.test(v), 'Enter a Rwandan phone number')
    .transform((v) => v || null),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .refine((v) => v === '' || z.string().email().safeParse(v).success, 'Enter a valid email')
    .transform((v) => v || null),
  // Kigali and surroundings only, to catch swapped lat/lng
  lat: z.number().min(-2.2, 'Pin must be in Kigali').max(-1.7, 'Pin must be in Kigali'),
  lng: z.number().min(29.9, 'Pin must be in Kigali').max(30.4, 'Pin must be in Kigali'),
  openingHours: z.object(Object.fromEntries(DAY_KEYS.map((d) => [d, hoursValue])) as Record<(typeof DAY_KEYS)[number], typeof hoursValue>),
  tags: z.array(z.string().trim().min(2).max(24)).max(6, 'At most 6 training styles'),
  amenities: z.array(z.string().trim().min(2).max(32)).max(16, 'At most 16 amenities'),
  diveCheckoutEnabled: z.boolean(),
  /** Only meaningful with DIVE-IN checkout on. */
  commissionOptIn: z.boolean(),
});
export type GymProfileInput = z.input<typeof gymProfileSchema>;

export const packageSchema = z.object({
  name: z.string().trim().min(2, 'Name the package').max(60),
  description: optionalText(300),
  durationDays: z.coerce.number().int('Whole days only').min(1, 'At least 1 day').max(730, 'At most 2 years'),
  priceRwf: z.coerce.number().int('Whole francs only').min(500, 'At least RWF 500').max(10_000_000),
  perks: z.array(z.string().trim().min(2).max(40)).max(8, 'At most 8 perks'),
  active: z.boolean().default(true),
});
export type PackageInput = z.input<typeof packageSchema>;

export const reorderSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(100) });

export const staffCreateSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter their full name').max(100),
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(160),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, ''))
    .refine((v) => /^(\+?250|0)7\d{8}$/.test(v), 'Enter a Rwandan phone number'),
});
export type StaffCreateInput = z.input<typeof staffCreateSchema>;

export const linkTrainerSchema = z.object({ email: z.string().trim().toLowerCase().email('Enter the trainer’s DIVE-IN account email') });

/** Owner records money taken at the front desk; activates or extends the membership. */
export const recordGymPaymentSchema = z.object({
  packageId: z.string().uuid(),
  note: z.string().trim().max(200).optional(),
});

export const receptionSearchSchema = z.object({
  q: z.string().trim().min(2, 'Type at least 2 characters').max(80),
});

export const memberListQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.enum(['ACTIVE', 'AWAITING_PAYMENT', 'EXPIRED', 'CANCELLED', 'EXPIRING']).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password').max(72),
    newPassword: z
      .string()
      .min(8, 'At least 8 characters')
      .max(72)
      .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Use letters and at least one number'),
  })
  .refine((v) => v.currentPassword !== v.newPassword, { path: ['newPassword'], message: 'Choose a different password' });
