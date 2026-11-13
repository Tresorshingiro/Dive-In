import Stripe from 'stripe';
import {
  WebhookSignatureError,
  type CheckoutRequest,
  type CheckoutResult,
  type PaymentProvider,
  type VerifiedPayment,
  type WebhookEvent,
} from './PaymentProvider';

/** Checkout Sessions must stay open at least 30 minutes (Stripe rule). */
const CHECKOUT_TTL_MIN = 35;

const HANDLED = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
]);

/**
 * Stripe Checkout (hosted page), card payments in RWF.
 * RWF is a zero-decimal currency in Stripe, so amounts are whole francs (no ×100).
 */
export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe';
  readonly method = 'CARD' as const;
  private stripe: Stripe;

  constructor(
    secretKey: string,
    private webhookSecret: string | undefined,
  ) {
    this.stripe = new Stripe(secretKey, { maxNetworkRetries: 2, appInfo: { name: 'DIVE-IN Fitness Hub' } });
  }

  async createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    const expiresAt = new Date(Date.now() + CHECKOUT_TTL_MIN * 60 * 1000);
    const session = await this.stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        currency: 'rwf',
        line_items: [
          {
            quantity: 1,
            price_data: { currency: 'rwf', unit_amount: req.amountRwf, product_data: { name: req.description } },
          },
        ],
        customer_email: req.customerEmail,
        client_reference_id: req.paymentId,
        metadata: { paymentId: req.paymentId },
        payment_intent_data: { metadata: { paymentId: req.paymentId } },
        success_url: req.successUrl,
        cancel_url: req.cancelUrl,
        expires_at: Math.floor(expiresAt.getTime() / 1000),
      },
      { idempotencyKey: req.idempotencyKey },
    );
    if (!session.url) throw new Error('Stripe did not return a checkout URL');
    return { providerRef: session.id, redirectUrl: session.url, expiresAt };
  }

  async verify(providerRef: string): Promise<VerifiedPayment> {
    const s = await this.stripe.checkout.sessions.retrieve(providerRef);
    let status: VerifiedPayment['status'] = 'PENDING';
    if (s.status === 'complete' && s.payment_status === 'paid') status = 'PAID';
    else if (s.status === 'expired') status = 'EXPIRED';
    return {
      providerRef: s.id,
      status,
      amountRwf: s.amount_total,
      currency: s.currency,
      paymentId: s.metadata?.paymentId ?? s.client_reference_id ?? null,
    };
  }

  async cancel(providerRef: string): Promise<void> {
    try {
      const s = await this.stripe.checkout.sessions.retrieve(providerRef);
      if (s.status === 'open') await this.stripe.checkout.sessions.expire(providerRef);
    } catch {
      /* already expired or completed — nothing to do */
    }
  }

  async refund(providerRef: string): Promise<string> {
    const s = await this.stripe.checkout.sessions.retrieve(providerRef);
    const pi = typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id;
    if (!pi) throw new Error('This checkout has no completed payment to refund');
    const r = await this.stripe.refunds.create({ payment_intent: pi }, { idempotencyKey: `dive-refund-${providerRef}` });
    return r.id;
  }

  parseWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): WebhookEvent {
    if (!this.webhookSecret) throw new WebhookSignatureError('STRIPE_WEBHOOK_SECRET is not configured');
    const sig = headers['stripe-signature'];
    if (typeof sig !== 'string') throw new WebhookSignatureError('Missing Stripe-Signature header');
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, sig, this.webhookSecret);
    } catch (e) {
      throw new WebhookSignatureError((e as Error).message);
    }
    if (!HANDLED.has(event.type)) return { eventId: event.id, type: event.type, providerRef: null, paymentId: null, payload: event };
    const session = event.data.object as Stripe.Checkout.Session;
    return {
      eventId: event.id,
      type: event.type,
      providerRef: session.id,
      paymentId: session.metadata?.paymentId ?? session.client_reference_id ?? null,
      payload: event,
    };
  }
}
