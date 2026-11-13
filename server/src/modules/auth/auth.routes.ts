import { Router, type Request } from 'express';
import rateLimit from 'express-rate-limit';
import { changePasswordSchema, loginSchema, registerSchema, totpCodeSchema } from '@dive/shared';
import { isProd } from '../../config/env';
import { validateBody } from '../../middleware/validate';
import { optionalAuth, requireAuth } from '../../middleware/auth';
import { REFRESH_COOKIE, clearAuthCookies, setAuthCookies } from '../../lib/tokens';
import * as auth from './auth.service';

const router = Router();

const client = (req: Request) => ({ ip: req.ip, userAgent: req.header('user-agent') });

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  // Only failed attempts count: stops password guessing without locking out a gym's shared connection.
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again in a few minutes.' } },
});

router.post('/register', loginLimiter, validateBody(registerSchema), async (req, res) => {
  const { userId, tokens } = await auth.register(req.body, client(req));
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  res.status(201).json({ user: await auth.toAuthUser(userId) });
});

router.post('/login', loginLimiter, validateBody(loginSchema), async (req, res) => {
  const { userId, tokens } = await auth.login(req.body, client(req));
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  res.json({ user: await auth.toAuthUser(userId) });
});

// Admin sign-in is two steps: password → 6-digit authenticator code. Tokens are issued only after step 2.
const MFA_COOKIE = 'dive_mfa';
const mfaCookie = { httpOnly: true, secure: isProd, sameSite: 'strict' as const, path: '/api/auth/admin' };

router.post('/admin/login', loginLimiter, validateBody(loginSchema), async (req, res) => {
  const { ticket, mfa } = await auth.adminPasswordStep(req.body, client(req));
  res.cookie(MFA_COOKIE, ticket, { ...mfaCookie, maxAge: 5 * 60 * 1000 });
  res.json({ mfa });
});

router.post('/admin/mfa/setup', loginLimiter, async (req, res) => {
  const userId = auth.readMfaTicket(req.cookies?.[MFA_COOKIE]);
  res.json(await auth.adminMfaSetup(userId));
});

router.post('/admin/mfa/verify', loginLimiter, validateBody(totpCodeSchema), async (req, res) => {
  const userId = auth.readMfaTicket(req.cookies?.[MFA_COOKIE]);
  const { tokens } = await auth.adminMfaVerify(userId, req.body.code, client(req));
  res.clearCookie(MFA_COOKIE, mfaCookie);
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  res.json({ user: await auth.toAuthUser(userId) });
});

router.post('/refresh', async (req, res) => {
  try {
    const { userId, tokens } = await auth.refresh(req.cookies?.[REFRESH_COOKIE], client(req));
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    res.json({ user: await auth.toAuthUser(userId) });
  } catch (e) {
    clearAuthCookies(res);
    throw e;
  }
});

router.post('/logout', optionalAuth, async (req, res) => {
  await auth.logout(req.cookies?.[REFRESH_COOKIE], req.user, req.ip);
  clearAuthCookies(res);
  res.status(204).end();
});

router.post('/change-password', loginLimiter, requireAuth, validateBody(changePasswordSchema), async (req, res) => {
  const tokens = await auth.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword, client(req));
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  res.json({ user: await auth.toAuthUser(req.user!.id) });
});

router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: await auth.toAuthUser(req.user!.id) });
});

export default router;
