import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { adminLogin, anon, key, login, pay, registerMember, reseed, signedWebhook, type Agent } from './helpers';

let monthlyId: string;
let quarterId: string;

beforeAll(async () => {
  reseed();
  const gym = (await anon().get('/api/gyms/iron-house')).body.gym;
  monthlyId = gym.packages.find((p: { durationDays: number }) => p.durationDays === 30).id;
  quarterId = gym.packages.find((p: { durationDays: number }) => p.durationDays === 90).id;
});

async function startCheckout(a: Agent, packageId = monthlyId, k = key()) {
  const r = await a.post('/api/me/memberships/checkout').set('Idempotency-Key', k).send({ packageId });
  expect(r.status).toBe(201);
  return r.body as { paymentId: string; membershipId: string; redirectUrl: string };
}

describe('payment verification', () => {
  it('a payment stays PENDING until the provider confirms it', async () => {
    const { a } = await registerMember();
    const c = await startCheckout(a);
    expect((await a.get(`/api/me/payments/${c.paymentId}`)).body.payment.status).toBe('PENDING');
    expect((await a.get(`/api/me/memberships/${c.membershipId}`)).body.membership.status).toBe('AWAITING_PAYMENT');
  });

  it('rejects webhooks with a missing or wrong signature', async () => {
    const { a } = await registerMember();
    const c = await startCheckout(a);
    const forged = Buffer.from(JSON.stringify({ id: 'evt_forged', type: 'payment.succeeded', providerRef: 'x', paymentId: c.paymentId }));
    const noSig = await anon().post('/api/webhooks/mock').set('content-type', 'application/json').send(forged);
    const badSig = await anon().post('/api/webhooks/mock').set('content-type', 'application/json').set('x-mock-signature', 'deadbeef').send(forged);
    expect(noSig.status).toBe(400);
    expect(badSig.status).toBe(400);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: c.paymentId } })).status).toBe('PENDING');
  });

  it('a correctly signed webhook is still verified with the provider — its body is not trusted', async () => {
    const { a } = await registerMember();
    const c = await startCheckout(a);
    const p = await prisma.payment.findUniqueOrThrow({ where: { id: c.paymentId } });
    // Signed "succeeded" event, but the provider itself says the session is still unpaid.
    const { body, signature } = signedWebhook({ id: `evt_${Date.now()}`, type: 'payment.succeeded', providerRef: p.providerRef, paymentId: p.id });
    const r = await anon().post('/api/webhooks/mock').set('content-type', 'application/json').set('x-mock-signature', signature).send(body);
    expect(r.status).toBe(200);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: c.paymentId } })).status).toBe('PENDING');
  });

  it('activates the membership only after verified payment', async () => {
    const { a } = await registerMember();
    const c = await startCheckout(a);
    expect(await pay(a, c.paymentId)).toBe('PAID');
    const m = (await a.get(`/api/me/memberships/${c.membershipId}`)).body.membership;
    expect(m.status).toBe('ACTIVE');
    expect((new Date(m.endsAt).getTime() - Date.now()) / 86_400_000).toBeCloseTo(30, 1);
  });

  it('never marks PAID when the provider collected a different amount', async () => {
    const { a } = await registerMember();
    const c = await startCheckout(a);
    // Our record now expects more than the provider will report.
    await prisma.payment.update({ where: { id: c.paymentId }, data: { amountRwf: 999_999 } });
    await pay(a, c.paymentId);
    const p = await prisma.payment.findUniqueOrThrow({ where: { id: c.paymentId } });
    expect(p.status).not.toBe('PAID');
    expect(p.failureReason).toMatch(/^NEEDS_REVIEW/);
    expect((await prisma.membership.findUniqueOrThrow({ where: { id: c.membershipId } })).status).toBe('AWAITING_PAYMENT');
  });

  it('a declined payment fails and the membership stays unpaid', async () => {
    const { a } = await registerMember();
    const c = await startCheckout(a);
    expect(await pay(a, c.paymentId, 'fail')).toBe('FAILED');
    expect((await prisma.membership.findUniqueOrThrow({ where: { id: c.membershipId } })).status).toBe('AWAITING_PAYMENT');
  });

  it('another member cannot see or complete my payment', async () => {
    const { a } = await registerMember();
    const c = await startCheckout(a);
    const other = (await registerMember()).a;
    expect((await other.get(`/api/me/payments/${c.paymentId}`)).status).toBe(404);
    expect((await other.post(`/api/payments/mock/${c.paymentId}/complete`).send({ outcome: 'success' })).status).toBe(404);
  });

  it('refunds go through the provider and withdraw what was bought', async () => {
    const { a, id } = await registerMember();
    const c = await startCheckout(a);
    await pay(a, c.paymentId);
    const { a: admin } = await adminLogin();
    const r = await admin.post(`/api/admin/payments/${c.paymentId}/refund`).send({ note: 'test' });
    expect(r.body.status).toBe('REFUNDED');
    expect((await prisma.membership.findUniqueOrThrow({ where: { id: c.membershipId } })).status).toBe('CANCELLED');
    expect((await admin.post(`/api/admin/payments/${c.paymentId}/refund`).send({})).status).toBe(400);
    expect(await prisma.notification.count({ where: { userId: id, type: 'payment.refunded' } })).toBe(1);
  });

  it('desk payments are recorded without commission and cannot be refunded by DIVE', async () => {
    const owner = await login('owner@demo.dive.rw');
    const awaiting = await prisma.membership.findFirstOrThrow({ where: { status: 'AWAITING_PAYMENT', gym: { slug: 'iron-house' } } });
    const r = await owner.post(`/api/gym/members/${awaiting.id}/payments`).set('Idempotency-Key', key()).send({ packageId: monthlyId });
    expect(r.status).toBe(201);
    const p = await prisma.payment.findUniqueOrThrow({ where: { id: r.body.paymentId } });
    expect(p).toMatchObject({ method: 'PAID_AT_GYM', status: 'PAID', commissionRwf: 0, payeeShareRwf: p.amountRwf });
    const { a: admin } = await adminLogin();
    expect((await admin.post(`/api/admin/payments/${p.id}/refund`).send({})).status).toBe(400);
  });

  it('renewal extends from the current end date', async () => {
    const { a } = await registerMember();
    const c1 = await startCheckout(a);
    await pay(a, c1.paymentId);
    const before = (await prisma.membership.findUniqueOrThrow({ where: { id: c1.membershipId } })).endsAt!;
    const c2 = await startCheckout(a, quarterId);
    expect(c2.membershipId).toBe(c1.membershipId);
    await pay(a, c2.paymentId);
    const after = (await prisma.membership.findUniqueOrThrow({ where: { id: c1.membershipId } })).endsAt!;
    expect((after.getTime() - before.getTime()) / 86_400_000).toBeCloseTo(90, 3);
  });
});
