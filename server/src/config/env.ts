import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required — copy server/.env.example to server/.env'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL_MIN: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  /** Admin sign-in with an authenticator app (TOTP). Off by default; set to "true" to require it. */
  ADMIN_MFA_ENABLED: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  /** stripe = real Stripe (test mode in dev); mock = offline provider used by automated tests */
  PAYMENT_PROVIDER: z.enum(['stripe', 'mock']).default('stripe'),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_', 'STRIPE_SECRET_KEY must start with sk_').optional().or(z.literal('')),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_', 'STRIPE_WEBHOOK_SECRET must start with whsec_').optional().or(z.literal('')),
  MOCK_PAYMENT_WEBHOOK_SECRET: z.string().min(8).default('dev-webhook-secret'),
  /** Where uploaded gym photos are stored (served at /uploads). Relative to the server folder. */
  UPLOAD_DIR: z.string().default('uploads'),
});

const parsed = schema
  .superRefine((v, ctx) => {
    // Never let a live key run outside production by accident.
    if (v.STRIPE_SECRET_KEY?.startsWith('sk_live_') && v.NODE_ENV !== 'production')
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['STRIPE_SECRET_KEY'], message: 'Use a test key (sk_test_…) outside production' });
  })
  .safeParse(process.env);
if (!parsed.success) {
  console.error('\n✖ Invalid server environment:');
  for (const i of parsed.error.issues) console.error(`  - ${i.path.join('.')}: ${i.message}`);
  console.error('');
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
