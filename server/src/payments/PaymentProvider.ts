/**
 * Every payment provider (Stripe now, MTN MoMo / Flutterwave later, the mock for tests)
 * implements this. The rest of the app never talks to a provider SDK directly.
 *
 * Trust rule: a payment becomes PAID only from `verify()` (a server-to-server lookup)
 * or a webhook whose signature `parseWebhook()` has checked — never from anything the
 * customer's browser sends.
 */
export interface CheckoutRequest {
  paymentId: string;
  amountRwf: number;
  description: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
  /** Passed to the provider so a retried call never opens a second checkout. */
  idempotencyKey: string;
}

export interface CheckoutResult {
  providerRef: string;
  redirectUrl: string;
  expiresAt: Date;
}

export type ProviderPaymentStatus = 'PAID' | 'PENDING' | 'FAILED' | 'EXPIRED';

export interface VerifiedPayment {
  providerRef: string;
  status: ProviderPaymentStatus;
  amountRwf: number | null;
  currency: string | null;
  /** Our payment id as stored in the provider's metadata. */
  paymentId: string | null;
}

export interface WebhookEvent {
  eventId: string;
  type: string;
  /** null for event types we don't handle */
  providerRef: string | null;
  paymentId: string | null;
  payload: unknown;
}

export class WebhookSignatureError extends Error {}

export interface PaymentProvider {
  readonly name: string;
  readonly method: 'CARD' | 'MOMO';
  createCheckout(req: CheckoutRequest): Promise<CheckoutResult>;
  verify(providerRef: string): Promise<VerifiedPayment>;
  /** Stop an open checkout so it can't be paid any more (best effort). */
  cancel(providerRef: string): Promise<void>;
  /** Refund a completed payment in full. Returns the provider's refund id. */
  refund(providerRef: string): Promise<string>;
  /** Verifies the signature, then normalises the event. Throws WebhookSignatureError if invalid. */
  parseWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): WebhookEvent;
}
