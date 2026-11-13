import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { adminLogin, agent, anon, key, login, PW, reseed, type Agent } from './helpers';

type Who = 'anon' | 'member' | 'owner' | 'reception' | 'trainer' | 'admin';
const users: Partial<Record<Who, Agent>> = {};

beforeAll(async () => {
  reseed();
  users.member = await login('member@demo.dive.rw');
  users.owner = await login('owner@demo.dive.rw');
  users.reception = await login('reception@demo.dive.rw');
  users.trainer = await login('trainer@demo.dive.rw');
  users.admin = (await adminLogin()).a;
});

const as = (who: Who) => (who === 'anon' ? anon() : users[who]!);

/** [endpoint, who may use it] — everyone else must get 401 (anonymous) or 403. */
const MATRIX: Array<[string, Who[]]> = [
  ['/api/me/memberships', ['member']],
  ['/api/me/payments', ['member']],
  ['/api/me/coach-pass', ['member']],
  ['/api/me/bookings', ['member']],
  ['/api/messages', ['member', 'trainer']],
  ['/api/gym/context', ['owner', 'reception']],
  ['/api/gym/overview', ['owner', 'reception']],
  ['/api/gym/reception/today', ['owner', 'reception']],
  ['/api/gym/profile', ['owner']],
  ['/api/gym/packages', ['owner']],
  ['/api/gym/members', ['owner']],
  ['/api/gym/staff', ['owner']],
  ['/api/gym/trainers', ['owner']],
  ['/api/gym/reports', ['owner']],
  ['/api/gym/payments', ['owner']],
  ['/api/gym/payments.csv', ['owner']],
  ['/api/gym/activity', ['owner']],
  ['/api/gym/subscription', ['owner']],
  ['/api/trainer/me', ['trainer']],
  ['/api/trainer/overview', ['trainer']],
  ['/api/trainer/availability', ['trainer']],
  ['/api/trainer/sessions', ['trainer']],
  ['/api/admin/overview', ['admin']],
  ['/api/admin/gyms', ['admin']],
  ['/api/admin/users', ['admin']],
  ['/api/admin/payments', ['admin']],
  ['/api/admin/config', ['admin']],
  ['/api/admin/audit', ['admin']],
  ['/api/admin/contact', ['admin']],
];
const EVERYONE: Who[] = ['anon', 'member', 'owner', 'reception', 'trainer', 'admin'];

describe('role-based access', () => {
  for (const [path, allowed] of MATRIX) {
    it(`${path}: only ${allowed.join(', ')}`, async () => {
      for (const who of EVERYONE) {
        const r = await as(who).get(path);
        if (allowed.includes(who)) expect(r.status, `${who} → ${path}`).toBe(200);
        else expect(r.status, `${who} → ${path}`).toBe(who === 'anon' ? 401 : 403);
      }
    });
  }

  it('public pages need no login', async () => {
    for (const p of ['/api/gyms', '/api/gyms/iron-house', '/api/trainers', '/api/config', '/api/health']) expect((await anon().get(p)).status).toBe(200);
  });

  it('pending gyms and unverified trainers are not public', async () => {
    expect((await anon().get('/api/gyms/kibagabaga-body-works')).status).toBe(404);
    const pending = await prisma.trainer.findFirstOrThrow({ where: { verificationStatus: 'PENDING' } });
    expect((await anon().get(`/api/coaches/${pending.id}`)).status).toBe(404);
  });
});

describe('gym isolation', () => {
  it('reception sees only its own gym and nothing personal or financial', async () => {
    const r = await users.reception!.get('/api/gym/reception/search?q=sarah');
    expect(r.body.results).toHaveLength(1); // Sarah's Pulse Studio membership is invisible here
    expect(r.body.results[0]).not.toHaveProperty('email');
    expect(r.body.results[0]).not.toHaveProperty('phone');
    expect(r.body.results[0]).not.toHaveProperty('priceRwf');
    expect((await users.reception!.get('/api/gym/overview')).body.overview.revenueThisMonthRwf).toBeUndefined();
  });

  it("a desk cannot check in another gym's member, even with the id", async () => {
    const pulse = await login('reception.pulse@demo.dive.rw');
    const ironMember = (await users.reception!.get('/api/gym/reception/search?q=samuel')).body.results[0];
    expect((await pulse.post('/api/gym/reception/check-in').send({ membershipId: ironMember.membershipId })).status).toBe(404);
  });

  it('reception cannot switch gyms with the X-Gym-Id header', async () => {
    const summit = await prisma.gym.findUniqueOrThrow({ where: { slug: 'summit-strength' } });
    expect((await users.reception!.get('/api/gym/context').set('X-Gym-Id', summit.id)).body.gym.name).toBe('Iron House');
  });

  it("an owner cannot open or edit another owner's gym", async () => {
    const summit = await prisma.gym.findUniqueOrThrow({ where: { slug: 'summit-strength' }, include: { packages: true } });
    expect((await users.owner!.get('/api/gym/context').set('X-Gym-Id', summit.id)).status).toBe(403);
    expect((await users.owner!.put(`/api/gym/packages/${summit.packages[0].id}`).send({ name: 'Hacked', durationDays: 30, priceRwf: 1000, perks: [] })).status).toBe(404);
  });

  it('reception cannot record payments or change prices', async () => {
    const m = (await users.reception!.get('/api/gym/reception/search?q=kalisa')).body.results[0];
    const pkg = await prisma.package.findFirstOrThrow({ where: { gym: { slug: 'iron-house' } } });
    expect((await users.reception!.post(`/api/gym/members/${m.membershipId}/payments`).set('Idempotency-Key', key()).send({ packageId: pkg.id })).status).toBe(403);
    expect((await users.reception!.put(`/api/gym/packages/${pkg.id}`).send({ name: 'x', durationDays: 30, priceRwf: 1000, perks: [] })).status).toBe(403);
  });

  it('entry is refused for expired and unpaid memberships', async () => {
    const results = (await users.reception!.get('/api/gym/reception/search?q=kalisa')).body.results;
    for (const r of results) {
      expect(r.entryAllowed).toBe(false);
      const c = await users.reception!.post('/api/gym/reception/check-in').send({ membershipId: r.membershipId });
      expect(c.body.checkIn.result).toBe('DENIED');
    }
  });
});

describe('accounts and sessions', () => {
  it('admins cannot use the regular login, and the admin login refuses others', async () => {
    expect((await anon().post('/api/auth/login').send({ email: 'admin@demo.dive.rw', password: PW })).status).toBe(403);
    expect((await anon().post('/api/auth/admin/login').send({ email: 'member@demo.dive.rw', password: PW })).status).toBe(403);
  });

  it('a correct admin password alone gives no session', async () => {
    const a = agent();
    await a.post('/api/auth/admin/login').send({ email: 'admin@demo.dive.rw', password: PW });
    expect((await a.get('/api/admin/overview')).status).toBe(401);
    expect((await a.post('/api/auth/admin/mfa/verify').send({ code: '000000' })).status).toBe(400);
  });

  it('staff with a temporary password are blocked until they change it', async () => {
    const created = await users.owner!.post('/api/gym/staff').send({ fullName: 'Desk Two', email: `desk-${Date.now()}@example.com`, phone: '0788123456' });
    const s = agent();
    const email = (await prisma.gymStaff.findUniqueOrThrow({ where: { id: created.body.staffId }, include: { user: true } })).user.email;
    await s.post('/api/auth/login').send({ email, password: created.body.temporaryPassword });
    expect((await s.get('/api/gym/reception/today')).body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
    await s.post('/api/auth/change-password').send({ currentPassword: created.body.temporaryPassword, newPassword: 'NewDesk2026' });
    expect((await s.get('/api/gym/reception/today')).status).toBe(200);
  });

  it('suspending a user ends their session immediately', async () => {
    const victim = await login('kalisa@demo.dive.rw');
    const u = await prisma.user.findUniqueOrThrow({ where: { email: 'kalisa@demo.dive.rw' } });
    expect((await users.admin!.post(`/api/admin/users/${u.id}/suspend`)).status).toBe(204);
    expect((await victim.get('/api/me/memberships')).status).toBe(401);
    expect((await anon().post('/api/auth/login').send({ email: 'kalisa@demo.dive.rw', password: PW })).status).toBe(403);
    await users.admin!.post(`/api/admin/users/${u.id}/reactivate`);
  });

  it('a reused refresh token revokes the whole session family', async () => {
    const a = await login('sarah@demo.dive.rw');
    const cookie = (await a.post('/api/auth/refresh')).headers['set-cookie'] as unknown as string[];
    const rt = cookie.find((c) => c.startsWith('dive_rt='))!.split(';')[0];
    await a.post('/api/auth/refresh'); // rotates again: rt is now an old token
    await new Promise((r) => setTimeout(r, 10));
    await prisma.refreshToken.updateMany({ where: { user: { email: 'sarah@demo.dive.rw' }, revokedAt: { not: null } }, data: { revokedAt: new Date(Date.now() - 60_000) } }); // past the race grace window
    expect((await anon().post('/api/auth/refresh').set('Cookie', rt)).status).toBe(401);
    expect((await a.post('/api/auth/refresh')).status).toBe(401); // the legitimate session died too
  });

  it('cross-site POSTs are refused', async () => {
    expect((await anon().post('/api/contact').set('Origin', 'https://evil.example').send({})).status).toBe(403);
  });
});
