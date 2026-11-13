import { Prisma, type PaymentPurpose } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from './prisma';
import { audit } from './audit';
import { HttpError, conflict } from './errors';
import { getProvider } from '../payments';

export interface OnlinePaymentRequest {
  user: { id: string; email: string; role: 'MEMBER' | 'GYM_OWNER' | string };
  purpose: PaymentPurpose;
  amountRwf: number;
  commissionRwf?: number;
  payeeShareRwf?: number;
  idempotencyKey: string;
  /** Identifies "the same purchase": a replayed key with a different fingerprint is rejected. */
  fingerprint: string;
  meta: Record<string, unknown>;
  description: string;
  /** Client path the provider returns to, e.g. "/app/checkout/return" */
  returnPath: string;
  gymId?: string | null;
  /** Creates the thing being paid for inside the same transaction; returns its id. */
  prepare: (tx: Prisma.TransactionClient) => Promise<string>;
  /** Undo `prepare` if the provider can't open a checkout (e.g. release a booking slot). */
  onProviderFailure?: (targetId: string) => Promise<void>;
}

export interface OnlinePaymentStarted {
  paymentId: string;
  targetId: string;
  redirectUrl: string;
}

/**
 * A retry can arrive while the first request is still talking to the provider (payment saved,
 * checkout link not yet). Wait briefly for it instead of failing, so every retry gets the same answer.
 */
export async function awaitCheckoutLink<T extends { id: string; status: string; checkoutUrl: string | null }>(p: T, reload: () => Promise<T | null>): Promise<T> {
  let cur = p;
  for (let i = 0; i < 40 && cur.status === 'PENDING' && !cur.checkoutUrl; i++) {
    await new Promise((r) => setTimeout(r, 150));
    cur = (await reload()) ?? cur;
  }
  return cur;
}

async function replay(userId: string, key: string, fingerprint: string, returnPath: string): Promise<OnlinePaymentStarted | null> {
  const where = { userId_idempotencyKey: { userId, idempotencyKey: key } };
  const found = await prisma.payment.findUnique({ where });
  if (!found) return null;
  const p = await awaitCheckoutLink(found, () => prisma.payment.findUnique({ where }));
  if ((p.meta as { fingerprint?: string } | null)?.fingerprint !== fingerprint) throw conflict('This Idempotency-Key was already used for a different purchase');
  if (p.status === 'PAID') return { paymentId: p.id, targetId: p.targetId, redirectUrl: `${env.CLIENT_URL}${returnPath}?payment=${p.id}` };
  if (p.status !== 'PENDING' || !p.checkoutUrl || (p.expiresAt && p.expiresAt < new Date())) throw conflict('That checkout is no longer open. Start a new one.');
  return { paymentId: p.id, targetId: p.targetId, redirectUrl: p.checkoutUrl };
}

/**
 * Creates a PENDING payment (+ its target, atomically) and opens the provider's hosted checkout.
 * The payment only becomes PAID later, through payments.service.applyVerified.
 */
export async function startOnlinePayment(r: OnlinePaymentRequest): Promise<OnlinePaymentStarted> {
  const again = await replay(r.user.id, r.idempotencyKey, r.fingerprint, r.returnPath);
  if (again) return again;
  const provider = getProvider();

  let payment;
  try {
    payment = await prisma.$transaction(async (tx) => {
      const targetId = await r.prepare(tx);
      return tx.payment.create({
        data: {
          userId: r.user.id,
          purpose: r.purpose,
          targetId,
          amountRwf: r.amountRwf,
          commissionRwf: r.commissionRwf ?? 0,
          payeeShareRwf: r.payeeShareRwf ?? 0,
          method: provider.method,
          provider: provider.name,
          idempotencyKey: r.idempotencyKey,
          meta: { ...r.meta, fingerprint: r.fingerprint } as Prisma.InputJsonValue,
        },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const winner = await replay(r.user.id, r.idempotencyKey, r.fingerprint, r.returnPath);
      if (winner) return winner;
    }
    throw e;
  }

  try {
    const checkout = await provider.createCheckout({
      paymentId: payment.id,
      amountRwf: payment.amountRwf,
      description: r.description,
      customerEmail: r.user.email,
      successUrl: `${env.CLIENT_URL}${r.returnPath}?payment=${payment.id}`,
      cancelUrl: `${env.CLIENT_URL}${r.returnPath}?payment=${payment.id}&cancelled=1`,
      idempotencyKey: `dive-checkout-${payment.id}`,
    });
    await prisma.payment.update({ where: { id: payment.id }, data: { providerRef: checkout.providerRef, checkoutUrl: checkout.redirectUrl, expiresAt: checkout.expiresAt } });
    await audit({ actorId: r.user.id, actorRole: r.user.role as never, action: 'payment.checkout_started', entity: 'payment', entityId: payment.id, gymId: r.gymId ?? null, after: { purpose: r.purpose, amountRwf: r.amountRwf } });
    return { paymentId: payment.id, targetId: payment.targetId, redirectUrl: checkout.redirectUrl };
  } catch (e) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED', failureReason: `Could not open checkout: ${(e as Error).message}`.slice(0, 300) } });
    await r.onProviderFailure?.(payment.targetId);
    if (e instanceof HttpError) throw e;
    console.error('createCheckout failed', e);
    throw new HttpError(502, 'PROVIDER_ERROR', 'The payment provider could not start checkout. Please try again.');
  }
}

/** Checkout expiry, so holds (e.g. a booking slot) can match it. */
export async function checkoutExpiry(paymentId: string) {
  return (await prisma.payment.findUnique({ where: { id: paymentId }, select: { expiresAt: true } }))?.expiresAt ?? null;
}
