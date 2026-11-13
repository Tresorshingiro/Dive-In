import { z } from 'zod';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const trainerProfileSchema = z.object({
  headline: z.string().trim().min(3, 'Add a short headline').max(80),
  bio: z.string().trim().max(1500).nullish().transform((v) => v || null),
  specialties: z.array(z.string().trim().min(2).max(30)).min(1, 'Pick at least one specialty').max(8),
  certifications: z.array(z.string().trim().min(2).max(80)).max(10),
  languages: z.array(z.string().trim().min(2).max(30)).max(6),
  yearsExperience: z.coerce.number().int().min(0).max(60).nullish().transform((v) => (v === undefined ? null : v)),
  sessionFeeRwf: z.coerce.number().int('Whole francs only').min(1000, 'At least RWF 1,000').max(1_000_000),
  sessionMinutes: z.coerce.number().int().refine((v) => [30, 45, 60, 90, 120].includes(v), 'Choose 30, 45, 60, 90 or 120 minutes'),
});
export type TrainerProfileInput = z.input<typeof trainerProfileSchema>;

export const availabilitySlotSchema = z
  .object({
    weekday: z.number().int().min(0).max(6), // 0 = Sunday
    startTime: z.string().regex(TIME, 'Use HH:MM'),
    endTime: z.string().regex(TIME, 'Use HH:MM'),
    gymId: z.string().uuid().nullish().transform((v) => v ?? null),
  })
  .refine((s) => s.startTime < s.endTime, { message: 'End must be after start', path: ['endTime'] });

export const availabilitySchema = z.object({
  slots: z.array(availabilitySlotSchema).max(50),
});

export const exceptionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  note: z.string().trim().max(120).optional(),
});

export const bookingCreateSchema = z.object({
  trainerId: z.string().uuid(),
  /** ISO time of a slot returned by the availability endpoint */
  startsAt: z.string().datetime(),
  note: z.string().trim().max(300).optional(),
});

export const cancelSchema = z.object({ reason: z.string().trim().max(200).optional() });

export const messageSchema = z.object({ body: z.string().trim().min(1, 'Write a message').max(2000) });
export const startConversationSchema = z.object({ trainerId: z.string().uuid(), body: z.string().trim().min(1).max(2000) });
