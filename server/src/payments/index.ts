import { env } from '../config/env';
import { HttpError } from '../lib/errors';
import { MockProvider } from './MockProvider';
import { StripeProvider } from './StripeProvider';
import type { PaymentProvider } from './PaymentProvider';

let stripe: StripeProvider | null = null;
let mock: MockProvider | null = null;

export function getMockProvider(): MockProvider {
  mock ??= new MockProvider(env.MOCK_PAYMENT_WEBHOOK_SECRET, env.CLIENT_URL);
  return mock;
}

/** The provider used for new online payments. */
export function getProvider(): PaymentProvider {
  if (env.PAYMENT_PROVIDER === 'mock') return getMockProvider();
  if (!env.STRIPE_SECRET_KEY) {
    throw new HttpError(503, 'PAYMENTS_NOT_CONFIGURED', 'Online payments are not set up yet (STRIPE_SECRET_KEY is missing on the server).');
  }
  stripe ??= new StripeProvider(env.STRIPE_SECRET_KEY, env.STRIPE_WEBHOOK_SECRET || undefined);
  return stripe;
}

/** Provider that created an existing payment (by the name stored on it). */
export function providerByName(name: string): PaymentProvider | null {
  if (name === 'mock') return getMockProvider();
  if (name === 'stripe') {
    try {
      const p = getProvider();
      return p.name === 'stripe' ? p : null;
    } catch {
      return null;
    }
  }
  return null;
}

export type { PaymentProvider } from './PaymentProvider';
