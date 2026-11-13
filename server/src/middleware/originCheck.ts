import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { forbidden } from '../lib/errors';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence on top of SameSite=Lax cookies: state-changing browser requests
 * must come from our own client origin. Requests with no Origin (curl, server-to-server
 * webhooks) are allowed through; webhooks authenticate with signatures instead.
 */
export function originCheck(req: Request, _res: Response, next: NextFunction) {
  if (SAFE.has(req.method)) return next();
  const origin = req.header('origin');
  if (origin && origin !== env.CLIENT_URL) throw forbidden('Cross-site request blocked');
  next();
}
