import { Router, type Request } from 'express';
import { z } from 'zod';
import { adminCreateSchema, auditQuerySchema, paymentListQuerySchema, platformConfigSchema, statusNoteSchema, userListQuerySchema } from '@dive/shared';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validateBody, validateQuery } from '../../middleware/validate';
import { refundPayment } from '../payments/payments.service';
import * as admin from './admin.service';

/**
 * /api/admin — DIVE-IN control centre. Admin sessions only exist after password + TOTP
 * (see /api/auth/admin/*), so requireRole('ADMIN') here implies two-factor sign-in.
 */
const router = Router();
router.use(requireAuth, requireRole('ADMIN'));

const me = (req: Request): admin.Admin => ({ id: req.user!.id, ip: req.ip ?? null });
const param = (req: Request, k: string) => String(req.params[k]);
const statusQ = (values: readonly [string, ...string[]]) => validateQuery(z.object({ status: z.enum(values).optional() }));

router.get('/overview', async (_req, res) => res.json({ area: 'admin', overview: await admin.overview() }));

router.get('/gyms', statusQ(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']), async (_req, res) => res.json({ gyms: await admin.listGyms(res.locals.query.status) }));
for (const action of ['approve', 'reject', 'suspend', 'reinstate'] as const) {
  router.post(`/gyms/:id/${action}`, validateBody(statusNoteSchema), async (req, res) => {
    await admin.setGymStatus(param(req, 'id'), action, req.body.note, me(req));
    res.status(204).end();
  });
}

router.get('/trainers', statusQ(['PENDING', 'VERIFIED', 'REJECTED']), async (_req, res) => res.json({ trainers: await admin.listTrainers(res.locals.query.status) }));
for (const [path, status] of [['verify', 'VERIFIED'], ['reject', 'REJECTED'], ['reopen', 'PENDING']] as const) {
  router.post(`/trainers/:id/${path}`, validateBody(statusNoteSchema), async (req, res) => {
    await admin.setTrainerStatus(param(req, 'id'), status, req.body.note, me(req));
    res.status(204).end();
  });
}

router.get('/users', validateQuery(userListQuerySchema), async (_req, res) => res.json(await admin.listUsers(res.locals.query)));
router.post('/users/:id/suspend', async (req, res) => {
  await admin.setUserStatus(param(req, 'id'), 'SUSPENDED', me(req));
  res.status(204).end();
});
router.post('/users/:id/reactivate', async (req, res) => {
  await admin.setUserStatus(param(req, 'id'), 'ACTIVE', me(req));
  res.status(204).end();
});
router.post('/users/:id/reset-password', async (req, res) => res.json(await admin.resetPassword(param(req, 'id'), me(req))));
router.post('/users/:id/reset-mfa', async (req, res) => {
  await admin.resetMfa(param(req, 'id'), me(req));
  res.status(204).end();
});
router.post('/admins', validateBody(adminCreateSchema), async (req, res) => res.status(201).json(await admin.createAdmin(req.body.fullName, req.body.email, me(req))));

router.get('/payments', validateQuery(paymentListQuerySchema), async (_req, res) => res.json(await admin.listPayments(res.locals.query)));
router.post('/payments/:id/refund', validateBody(statusNoteSchema), async (req, res) => {
  const p = await refundPayment(param(req, 'id'), req.body.note, me(req));
  res.json({ status: p.status });
});
router.post('/payments/:id/resolve', validateBody(statusNoteSchema), async (req, res) => {
  await admin.resolveReview(param(req, 'id'), req.body.note, me(req));
  res.status(204).end();
});

router.get('/config', async (_req, res) => res.json({ config: await admin.getConfigForAdmin() }));
router.put('/config', validateBody(platformConfigSchema), async (req, res) => res.json({ config: await admin.updateConfig(req.body, me(req)) }));

router.get('/contact', validateQuery(z.object({ all: z.coerce.boolean().optional() })), async (_req, res) => res.json({ messages: await admin.listContact(!res.locals.query.all) }));
router.post('/contact/:id/handled', async (req, res) => {
  await admin.handleContact(param(req, 'id'), me(req));
  res.status(204).end();
});

router.get('/audit', validateQuery(auditQuerySchema), async (_req, res) => res.json(await admin.auditLog(res.locals.query)));

export default router;
