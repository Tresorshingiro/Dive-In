import { Router } from 'express';
import type { NotificationView } from '@dive/shared';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middleware/auth';
import { getMyPayment } from '../payments/payments.service';

/**
 * Things every signed-in role has: notifications and their own payments.
 * Mounted at /api, so auth is applied per route (a router-level guard would block public routes).
 */
const router = Router();

router.get('/notifications', requireAuth, async (req, res) => {
  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.notification.count({ where: { userId: req.user!.id, readAt: null } }),
  ]);
  const notifications: NotificationView[] = rows.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, link: n.link, readAt: n.readAt?.toISOString() ?? null, createdAt: n.createdAt.toISOString() }));
  res.json({ notifications, unread });
});

router.post('/notifications/read', requireAuth, async (req, res) => {
  const id = typeof req.body?.id === 'string' ? req.body.id : undefined;
  await prisma.notification.updateMany({ where: { userId: req.user!.id, readAt: null, ...(id ? { id } : {}) }, data: { readAt: new Date() } });
  res.status(204).end();
});

/** Own payment by id (pending ones are re-verified with the provider). */
router.get('/payments/:id', requireAuth, async (req, res) => {
  res.json({ payment: await getMyPayment(req.user!.id, String(req.params.id)) });
});

export default router;
