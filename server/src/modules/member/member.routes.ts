import { Router } from 'express';
import { idempotencyKeySchema, membershipCheckoutSchema, membershipRequestSchema, type NotificationView } from '@dive/shared';
import { prisma } from '../../lib/prisma';
import { badRequest } from '../../lib/errors';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import * as memberships from '../memberships/memberships.service';
import * as payments from '../payments/payments.service';

/** Everything under /api/me is the logged-in member's own data only. */
const router = Router();
router.use(requireAuth, requireRole('MEMBER'));

router.get('/memberships', async (req, res) => {
  res.json({ memberships: await memberships.listMine(req.user!.id) });
});

router.get('/memberships/:id', async (req, res) => {
  res.json({ membership: await memberships.getMine(req.user!.id, req.params.id) });
});

/** Start online payment. Requires an Idempotency-Key header (one per purchase attempt). */
router.post('/memberships/checkout', validateBody(membershipCheckoutSchema), async (req, res) => {
  const key = idempotencyKeySchema.safeParse(req.header('idempotency-key'));
  if (!key.success) throw badRequest(key.error.issues[0].message);
  const started = await memberships.startCheckout({ id: req.user!.id, email: req.user!.email }, req.body.packageId, key.data);
  res.status(201).json(started);
});

/** Gyms without DIVE-IN checkout: reserve the membership, pay at reception. */
router.post('/memberships/request', validateBody(membershipRequestSchema), async (req, res) => {
  res.status(201).json({ membership: await memberships.requestAtGym(req.user!.id, req.body.packageId) });
});

router.post('/memberships/:id/cancel', async (req, res) => {
  await memberships.cancelUnpaid(req.user!.id, req.params.id);
  res.status(204).end();
});

router.get('/payments', async (req, res) => {
  res.json({ payments: await payments.listMyPayments(req.user!.id) });
});

/** Polled by the checkout return page; pending payments are re-verified with the provider. */
router.get('/payments/:id', async (req, res) => {
  res.json({ payment: await payments.getMyPayment(req.user!.id, req.params.id) });
});

router.get('/notifications', async (req, res) => {
  const rows = await prisma.notification.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' }, take: 50 });
  const unread = await prisma.notification.count({ where: { userId: req.user!.id, readAt: null } });
  const notifications: NotificationView[] = rows.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  }));
  res.json({ notifications, unread });
});

/** Mark one ({ id }) or all (no body) as read. */
router.post('/notifications/read', async (req, res) => {
  const id = typeof req.body?.id === 'string' ? req.body.id : undefined;
  await prisma.notification.updateMany({ where: { userId: req.user!.id, readAt: null, ...(id ? { id } : {}) }, data: { readAt: new Date() } });
  res.status(204).end();
});

export default router;
