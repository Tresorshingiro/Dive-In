import crypto from 'node:crypto';
import {
  WebhookSignatureError,
  type CheckoutRequest,
  type CheckoutResult,
  type PaymentProvider,
  type ProviderPaymentStatus,
  type VerifiedPayment,
  type WebhookEvent,
} from './PaymentProvider';

interface MockSession {
  paymentId: string;
  amountRwf: number;
  status: ProviderPaymentStatus;
}

/**
 * Offline stand-in for a real provider, used by automated tests (PAYMENT_PROVIDER=mock).
 * Its "hosted page" is /pay/mock/:paymentId in the client; the outcome is reported to the
 * server as an HMAC-signed webhook, exactly like a real provider.
 */
export class MockProvider implements PaymentProvider {
  readonly name = 'mock';
  readonly method = 'CARD' as const;
  private sessions = new Map<string, MockSession>();
  private byIdempotencyKey = new Map<string, CheckoutResult>();

  constructor(
    private secret: string,
    private clientUrl: string,
  ) {}

  async createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    const existing = this.byIdempotencyKey.get(req.idempotencyKey);
    if (existing) return existing;
    const providerRef = `mock_${crypto.randomUUID()}`;
    this.sessions.set(providerRef, { paymentId: req.paymentId, amountRwf: req.amountRwf, status: 'PENDING' });
    const result = { providerRef, redirectUrl: `${this.clientUrl}/pay/mock/${req.paymentId}`, expiresAt: new Date(Date.now() + 35 * 60 * 1000) };
    this.byIdempotencyKey.set(req.idempotencyKey, result);
    return result;
  }

  async verify(providerRef: string): Promise<VerifiedPayment> {
    const s = this.sessions.get(providerRef);
    if (!s) return { providerRef, status: 'EXPIRED', amountRwf: null, currency: null, paymentId: null };
    return { providerRef, status: s.status, amountRwf: s.amountRwf, currency: 'rwf', paymentId: s.paymentId };
  }

  async cancel(providerRef: string) {
    const s = this.sessions.get(providerRef);
    if (s && s.status === 'PENDING') s.status = 'EXPIRED';
  }

  async refund(providerRef: string) {
    const s = this.sessions.get(providerRef);
    if (!s || s.status !== 'PAID') throw new Error('Nothing to refund');
    return `mock_refund_${crypto.randomUUID()}`;
  }

  /** Test/dev helper: the "customer" finishes the mock page. Returns a signed webhook to deliver. */
  complete(providerRef: string, outcome: 'success' | 'fail') {
    const s = this.sessions.get(providerRef);
    if (!s) throw new Error('Unknown mock session');
    if (s.status === 'PENDING') s.status = outcome === 'success' ? 'PAID' : 'FAILED';
    const body = Buffer.from(
      JSON.stringify({ id: `evt_${crypto.randomUUID()}`, type: outcome === 'success' ? 'payment.succeeded' : 'payment.failed', providerRef, paymentId: s.paymentId }),
    );
    return { body, headers: { 'x-mock-signature': this.sign(body) } };
  }

  sign(body: Buffer) {
    return crypto.createHmac('sha256', this.secret).update(body).digest('hex');
  }

  parseWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): WebhookEvent {
    const sig = headers['x-mock-signature'];
    if (typeof sig !== 'string') throw new WebhookSignatureError('Missing signature');
    const expected = Buffer.from(this.sign(rawBody), 'hex');
    const given = Buffer.from(sig, 'hex');
    if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) throw new WebhookSignatureError('Bad signature');
    const e = JSON.parse(rawBody.toString('utf8')) as { id: string; type: string; providerRef: string; paymentId: string };
    return { eventId: e.id, type: e.type, providerRef: e.providerRef, paymentId: e.paymentId, payload: e };
  }
}
