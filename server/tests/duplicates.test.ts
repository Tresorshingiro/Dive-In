import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { anon, key, login, pay, registerMember, reseed, signedWebhook, type Agent } from './helpers';

let monthlyId: string;
let ericId: string;

beforeAll(async () => {
  reseed();
  monthlyId = (await anon().get('/api/gyms/iron-house')).body.gym.packages.find((p: { durationDays: number }) => p.durationDays === 30).id;
  ericId = (await anon().get('/api/trainers')).body.trainers.find((t: { fullName: string }) => t.fullName === 'Eric Niyonzima').id;
});

const checkout = (a: Agent, k: string, packageId = monthlyId) => a.post('/api/me/memberships/checkout').set('Idempotency-Key', k).send({ packageId });

async function memberWithPass() {
  const m = await registerMember();
  const r = await m.a.post('/api/me/coach-pass/checkout').set('Idempotency-Key', key());
  await pay(m.a, r.body.paymentId);
  return m;
}

describe('duplicate payment prevention', () => {
  it('requires an Idempotency-Key', async () => {
    const { a } = await registerMember();
    expect((await a.post('/api/me/memberships/checkout').send({ packageId: monthlyId })).status).toBe(400);
  });

  it('the same key returns the same payment, even for parallel retries', async () => {
    const { a, id } = await registerMember();
    const k = key();
    const results = await Promise.all(Array.from({ length: 5 }, () => checkout(a, k)));
    const ids = new Set(results.map((r) => r.body.paymentId));
    expect(results.every((r) => r.status === 201)).toBe(true);
    expect(ids.size).toBe(1);
    expect(await prisma.payment.count({ where: { userId: id } })).toBe(1);
  });

  it('reusing a key for a different purchase is refused', async () => {
    const { a } = await registerMember();
    const k = key();
    await checkout(a, k);
    const quarter = (await anon().get('/api/gyms/iron-house')).body.gym.packages.find((p: { durationDays: number }) => p.durationDays === 90).id;
    expect((await checkout(a, k, quarter)).status).toBe(409);
  });

  it('a new checkout cancels the older open one, so only one can ever be paid', async () => {
    const { a } = await registerMember();
    const c1 = (await checkout(a, key())).body;
    const c2 = (await checkout(a, key())).body;
    expect(c2.membershipId).toBe(c1.membershipId);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: c1.paymentId } })).status).toBe('CANCELLED');
  });

  it('one live membership per member per gym (database-enforced)', async () => {
    const { id } = await registerMember();
    const gym = await prisma.gym.findUniqueOrThrow({ where: { slug: 'iron-house' } });
    await prisma.membership.create({ data: { memberId: id, gymId: gym.id, packageId: monthlyId, priceRwf: 1 } });
    await expect(prisma.membership.create({ data: { memberId: id, gymId: gym.id, packageId: monthlyId, priceRwf: 1 } })).rejects.toMatchObject({ code: 'P2002' });
  });

  it('a webhook delivered twice is processed once', async () => {
    const { a } = await registerMember();
    const c = (await checkout(a, key())).body;
    await pay(a, c.paymentId);
    const endsAt = (await prisma.membership.findUniqueOrThrow({ where: { id: c.membershipId } })).endsAt;
    const p = await prisma.payment.findUniqueOrThrow({ where: { id: c.paymentId } });
    const { body, signature } = signedWebhook({ id: 'evt_dup_1', type: 'payment.succeeded', providerRef: p.providerRef, paymentId: p.id });
    const send = () => anon().post('/api/webhooks/mock').set('content-type', 'application/json').set('x-mock-signature', signature).send(body);
    expect((await send()).body.result).toBe('PAID');
    expect((await send()).body.result).toBe('duplicate');
    expect(await prisma.paymentEvent.count({ where: { eventId: 'evt_dup_1' } })).toBe(1);
    expect((await prisma.membership.findUniqueOrThrow({ where: { id: c.membershipId } })).endsAt).toEqual(endsAt);
  });

  it('a second confirmation for the same payment never extends the membership again', async () => {
    const { a } = await registerMember();
    const c = (await checkout(a, key())).body;
    await pay(a, c.paymentId);
    const endsAt = (await prisma.membership.findUniqueOrThrow({ where: { id: c.membershipId } })).endsAt;
    await pay(a, c.paymentId);
    expect((await prisma.membership.findUniqueOrThrow({ where: { id: c.membershipId } })).endsAt).toEqual(endsAt);
  });

  it('desk payments with the same key are recorded once', async () => {
    const owner = await login('owner@demo.dive.rw');
    const { id } = await registerMember();
    const gym = await prisma.gym.findUniqueOrThrow({ where: { slug: 'iron-house' } });
    const m = await prisma.membership.create({ data: { memberId: id, gymId: gym.id, packageId: monthlyId, priceRwf: 60000 } });
    const k = key();
    const [r1, r2] = await Promise.all([1, 2].map(() => owner.post(`/api/gym/members/${m.id}/payments`).set('Idempotency-Key', k).send({ packageId: monthlyId })));
    expect(r1.body.paymentId).toBe(r2.body.paymentId);
    expect(await prisma.payment.count({ where: { targetId: m.id } })).toBe(1);
  });
});

describe('duplicate booking prevention', () => {
  it('two members racing for the same slot: exactly one gets it', async () => {
    const [m1, m2, m3] = await Promise.all([memberWithPass(), memberWithPass(), memberWithPass()]);
    const slot = (await m1.a.get(`/api/coaches/${ericId}`)).body.coach.slots[0].times[0];
    const results = await Promise.all([m1, m2, m3].map((m) => m.a.post('/api/me/bookings').set('Idempotency-Key', key()).send({ trainerId: ericId, startsAt: slot })));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(2);
    expect(await prisma.booking.count({ where: { trainerId: ericId, startsAt: new Date(slot), status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] } } })).toBe(1);
  });

  it('a slot held by an unpaid booking is not offered again; releasing it frees the slot', async () => {
    const m = await memberWithPass();
    const slot = (await m.a.get(`/api/coaches/${ericId}`)).body.coach.slots[0].times[0];
    const b = (await m.a.post('/api/me/bookings').set('Idempotency-Key', key()).send({ trainerId: ericId, startsAt: slot })).body;
    const times = async () => (await m.a.get(`/api/coaches/${ericId}`)).body.coach.slots.flatMap((d: { times: string[] }) => d.times);
    expect(await times()).not.toContain(slot);
    await m.a.post(`/api/me/bookings/${b.bookingId}/cancel`).send({});
    expect(await times()).toContain(slot);
  });

  it('times outside availability are refused', async () => {
    const m = await memberWithPass();
    const odd = new Date(Date.now() + 3 * 86_400_000 + 7 * 60_000).toISOString();
    expect((await m.a.post('/api/me/bookings').set('Idempotency-Key', key()).send({ trainerId: ericId, startsAt: odd })).status).toBe(409);
  });

  it('a slot can only hold one live booking (database-enforced)', async () => {
    const m1 = await registerMember();
    const m2 = await registerMember();
    const startsAt = new Date(Date.now() + 40 * 86_400_000);
    const data = (memberId: string) => ({ memberId, trainerId: ericId, startsAt, endsAt: new Date(startsAt.getTime() + 3_600_000), feeRwf: 1 });
    await prisma.booking.create({ data: data(m1.id) });
    await expect(prisma.booking.create({ data: data(m2.id) })).rejects.toMatchObject({ code: 'P2002' });
  });
});

describe('duplicate check-ins', () => {
  it('a double tap at reception records one check-in', async () => {
    const desk = await login('reception@demo.dive.rw');
    const r = (await desk.get('/api/gym/reception/search?q=samuel')).body.results[0];
    const before = await prisma.checkIn.count({ where: { membershipId: r.membershipId } });
    const taps = await Promise.all([1, 2, 3].map(() => desk.post('/api/gym/reception/check-in').send({ membershipId: r.membershipId })));
    expect(new Set(taps.map((t) => t.body.checkIn.id)).size).toBe(1);
    expect(taps.filter((t) => t.body.duplicate)).toHaveLength(2);
    expect(await prisma.checkIn.count({ where: { membershipId: r.membershipId } })).toBe(before + 1);
  });
});
