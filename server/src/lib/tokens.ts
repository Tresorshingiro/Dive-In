import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Response } from 'express';
import type { Role } from '@prisma/client';
import { env, isProd } from '../config/env';

export const ACCESS_COOKIE = 'dive_at';
export const REFRESH_COOKIE = 'dive_rt';

export interface AccessPayload {
  sub: string;
  role: Role;
}

export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: `${env.ACCESS_TOKEN_TTL_MIN}m`,
    issuer: 'dive',
    audience: 'dive-web',
  });
}

export function verifyAccessToken(token: string): AccessPayload | null {
  try {
    const p = jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: 'dive', audience: 'dive-web' }) as jwt.JwtPayload;
    if (typeof p.sub !== 'string' || typeof p.role !== 'string') return null;
    return { sub: p.sub, role: p.role as Role };
  } catch {
    return null;
  }
}

/** Refresh tokens are opaque random strings; only their HMAC is stored. */
export function newRefreshToken(): string {
  return crypto.randomBytes(48).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return crypto.createHmac('sha256', env.JWT_REFRESH_SECRET).update(token).digest('hex');
}

export function refreshExpiry(): Date {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

const base = { httpOnly: true, secure: isProd, sameSite: 'lax' as const };

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...base,
    path: '/api',
    maxAge: env.ACCESS_TOKEN_TTL_MIN * 60 * 1000,
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...base,
    path: '/api/auth', // only sent to refresh/logout
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { ...base, path: '/api' });
  res.clearCookie(REFRESH_COOKIE, { ...base, path: '/api/auth' });
}
