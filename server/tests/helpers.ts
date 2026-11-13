import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import request from 'supertest';
import { createApp } from '../src/app';
import { totpCode, currentStep } from '../src/lib/totp';
import { getMockProvider } from '../src/payments';

export const app = createApp();
export const PW = 'DiveDemo2026';
export type Agent = ReturnType<typeof request.agent>;

/** Wipes the test database and loads the demo seed (≈ 5 s). */
export function reseed() {
  execSync('npx tsx prisma/seed.ts', { env: { ...process.env }, stdio: 'pipe' });
}

export const agent = () => request.agent(app);
export const anon = () => request(app);
export const key = () => `test-${crypto.randomUUID()}`;

export async function login(email: string, password = PW): Promise<Agent> {
  const a = agent();
  const r = await a.post('/api/auth/login').send({ email, password });
  if (r.status !== 200) throw new Error(`login ${email} → ${r.status} ${JSON.stringify(r.body)}`);
  return a;
}

export async function registerMember(): Promise<{ a: Agent; email: string; id: string }> {
  const a = agent();
  const email = `t-${crypto.randomUUID().slice(0, 8)}@example.com`;
  const r = await a.post('/api/auth/register').send({ role: 'MEMBER', fullName: 'Test Member', email, phone: '0781234567', password: 'Passw0rdX' });
  if (r.status !== 201) throw new Error(`register → ${r.status}`);
  return { a, email, id: r.body.user.id };
}

/** Completes a mock checkout; returns the server's verification result ("PAID", "FAILED", "duplicate"…). */
export async function pay(a: Agent, paymentId: string, outcome: 'success' | 'fail' = 'success') {
  const r = await a.post(`/api/payments/mock/${paymentId}/complete`).send({ outcome });
  return r.body.result as string;
}

/** Builds a correctly signed mock webhook (as the provider would send it). Send `body` as-is (a string). */
export function signedWebhook(event: Record<string, unknown>) {
  const body = JSON.stringify(event);
  return { body, signature: getMockProvider().sign(Buffer.from(body)) };
}

let admin: { a: Agent; secret: string } | null = null;

/** Full admin sign-in: password → TOTP setup → verify. Reused within a test file (codes are single-use). */
export async function adminLogin(email = 'admin@demo.dive.rw'): Promise<{ a: Agent; secret: string }> {
  if (admin) return admin;
  const a = agent();
  const step1 = await a.post('/api/auth/admin/login').send({ email, password: PW });
  if (step1.status !== 200) throw new Error(`admin login → ${step1.status}`);
  const setup = await a.post('/api/auth/admin/mfa/setup');
  const secret = setup.body.secret as string;
  const v = await a.post('/api/auth/admin/mfa/verify').send({ code: totpCode(secret, currentStep()) });
  if (v.status !== 200) throw new Error(`admin verify → ${v.status} ${JSON.stringify(v.body)}`);
  admin = { a, secret };
  return admin;
}
