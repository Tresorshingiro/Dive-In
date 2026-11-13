import { describe, expect, it } from 'vitest';
import { formatMembershipNumber, registerSchema } from '@dive/shared';
import { base32Encode, currentStep, decryptSecret, encryptSecret, totpCode, verifyTotp } from '../src/lib/totp';
import { entryDecision, parseMembershipNumber } from '../src/modules/gym/reception.service';
import { kigaliDate } from '../src/modules/coaching/slots';
import { kigaliDayStart } from '../src/lib/time';

describe('TOTP (RFC 6238)', () => {
  const secret = base32Encode(Buffer.from('12345678901234567890'));
  it('matches the RFC test vectors (last 6 digits)', () => {
    expect(totpCode(secret, Math.floor(59 / 30))).toBe('287082');
    expect(totpCode(secret, Math.floor(1111111109 / 30))).toBe('081804');
    expect(totpCode(secret, Math.floor(2000000000 / 30))).toBe('279037');
  });
  it('accepts ±1 step, rejects replays and wrong codes', () => {
    const step = currentStep();
    expect(verifyTotp(secret, totpCode(secret, step), null)).toBe(step);
    expect(verifyTotp(secret, totpCode(secret, step - 1), null)).toBe(step - 1);
    expect(verifyTotp(secret, totpCode(secret, step), step)).toBeNull();
    expect(verifyTotp(secret, totpCode(secret, step - 3), null)).toBeNull();
  });
  it('encrypts secrets at rest', () => {
    const enc = encryptSecret(secret);
    expect(enc).not.toContain(secret);
    expect(decryptSecret(enc)).toBe(secret);
  });
});

describe('reception rules', () => {
  const future = new Date(Date.now() + 86_400_000);
  const past = new Date(Date.now() - 86_400_000);
  it('allows only active + verified', () => {
    expect(entryDecision({ status: 'ACTIVE', endsAt: future }, true).allowed).toBe(true);
    expect(entryDecision({ status: 'ACTIVE', endsAt: future }, false).allowed).toBe(false);
    expect(entryDecision({ status: 'ACTIVE', endsAt: past }, true)).toMatchObject({ allowed: false, status: 'EXPIRED' });
    expect(entryDecision({ status: 'AWAITING_PAYMENT', endsAt: null }, false).allowed).toBe(false);
    expect(entryDecision({ status: 'CANCELLED', endsAt: future }, true).allowed).toBe(false);
  });
  it('parses membership numbers in any common form', () => {
    for (const s of ['DV-0000-0012', 'dv00000012', '0012', '12', ' DV 0000 0012 ']) expect(parseMembershipNumber(s)).toBe(12);
    expect(parseMembershipNumber('Billy')).toBeNull();
    expect(formatMembershipNumber(12)).toBe('DV-0000-0012');
  });
});

describe('Kigali time', () => {
  it('day boundaries are UTC+2', () => {
    // 23:30 UTC on the 1st is already the 2nd in Kigali
    expect(kigaliDate(new Date('2026-11-01T23:30:00Z')).iso).toBe('2026-11-02');
    expect(kigaliDayStart(new Date('2026-11-01T23:30:00Z')).toISOString()).toBe('2026-11-01T22:00:00.000Z');
  });
});

describe('validation', () => {
  it('requires gym details for gym owners and a Rwandan phone number', () => {
    const base = { role: 'GYM_OWNER', fullName: 'A Owner', email: 'a@b.rw', phone: '0781234567', password: 'Passw0rdX' };
    expect(registerSchema.safeParse(base).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, gymName: 'Gym', neighbourhood: 'Remera' }).success).toBe(true);
    expect(registerSchema.safeParse({ ...base, role: 'MEMBER', phone: '12345' }).success).toBe(false);
  });
});
