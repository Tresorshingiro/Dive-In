import { z } from 'zod';
import { CONTACT_ROLES, NEIGHBOURHOODS, SELF_REGISTER_ROLES } from './constants';

const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(160);
/** Rwandan numbers: +2507XXXXXXXX or 07XXXXXXXX. Spaces are ignored. */
const phone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ''))
  .refine((v) => /^(\+?250|0)7\d{8}$/.test(v), 'Enter a Rwandan phone number, e.g. 078 123 4567');
const password = z
  .string()
  .min(8, 'At least 8 characters')
  .max(72, 'At most 72 characters')
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Use letters and at least one number');
const fullName = z.string().trim().min(2, 'Enter your full name').max(100);

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password').max(72),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    role: z.enum(SELF_REGISTER_ROLES),
    fullName,
    email,
    phone,
    password,
    // gym owners only
    gymName: z.string().trim().max(100).optional(),
    neighbourhood: z.enum(NEIGHBOURHOODS).optional(),
    // trainers only
    specialties: z.array(z.string().trim().min(2).max(40)).max(8).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.role === 'GYM_OWNER') {
      if (!v.gymName || v.gymName.length < 2)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['gymName'], message: 'Enter your gym name' });
      if (!v.neighbourhood)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['neighbourhood'], message: 'Pick a neighbourhood' });
    }
  });
export type RegisterInput = z.infer<typeof registerSchema>;

export const contactSchema = z
  .object({
    name: fullName,
    email,
    phone: phone.optional().or(z.literal('').transform(() => undefined)),
    role: z.enum(CONTACT_ROLES),
    gymName: z.string().trim().max(100).optional(),
    neighbourhood: z.enum(NEIGHBOURHOODS).optional(),
    message: z.string().trim().min(10, 'Tell us a bit more (10+ characters)').max(2000),
    /** honeypot — real users never fill this */
    website: z.string().max(0).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.role === 'GYM_OWNER') {
      if (!v.gymName || v.gymName.length < 2)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['gymName'], message: 'Enter your gym name' });
      if (!v.neighbourhood)
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['neighbourhood'], message: 'Pick a neighbourhood' });
    }
  });
export type ContactInput = z.infer<typeof contactSchema>;

export const gymListQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  neighbourhood: z.enum(NEIGHBOURHOODS).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type GymListQuery = z.infer<typeof gymListQuerySchema>;

export const trainerListQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/** Start paying for a membership package online (DIVE-IN checkout). */
export const membershipCheckoutSchema = z.object({
  packageId: z.string().uuid(),
});
export type MembershipCheckoutInput = z.infer<typeof membershipCheckoutSchema>;

/** Ask to join a gym that collects payment at the front desk. */
export const membershipRequestSchema = z.object({
  packageId: z.string().uuid(),
});

/** Client-generated key that makes "create payment" safe to retry. */
export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(16, 'Idempotency-Key header must be 16–100 characters')
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/, 'Idempotency-Key may only use letters, digits, - and _');

/** Turns a ZodError into { field: message } for forms. */
export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
