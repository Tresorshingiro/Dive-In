import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ACCESS_COOKIE, verifyAccessToken } from '../lib/tokens';
import { HttpError, forbidden, unauthorized } from '../lib/errors';

async function loadUser(req: Request) {
  const token = req.cookies?.[ACCESS_COOKIE] as string | undefined;
  if (!token) return null;
  const payload = verifyAccessToken(token);
  if (!payload) return null;
  // Re-read the user so suspensions and role changes apply immediately, not after token expiry.
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, role: true, email: true, fullName: true, status: true, mustChangePassword: true },
  });
  if (!user || user.status !== 'ACTIVE') return null;
  return { id: user.id, role: user.role, email: user.email, fullName: user.fullName, mustChangePassword: user.mustChangePassword };
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const loaded = await loadUser(req);
  if (!loaded) throw unauthorized();
  const { mustChangePassword, ...user } = loaded;
  // Temporary-password accounts may only reach /api/auth/* (me, change-password, logout).
  if (mustChangePassword && !req.originalUrl.startsWith('/api/auth/')) {
    throw new HttpError(403, 'PASSWORD_CHANGE_REQUIRED', 'Set a new password before continuing');
  }
  req.user = user;
  next();
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const loaded = await loadUser(req);
  req.user = loaded ? { id: loaded.id, role: loaded.role, email: loaded.email, fullName: loaded.fullName } : undefined;
  next();
}

/** Use after requireAuth. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw unauthorized();
    if (!roles.includes(req.user.role)) throw forbidden();
    next();
  };
}
