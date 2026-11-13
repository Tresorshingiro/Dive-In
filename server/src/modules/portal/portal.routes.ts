import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireRole } from '../../middleware/auth';

/**
 * Small per-role "overview" probes used by the access-check panels and tests.
 * Gym, trainer and admin overviews live in their own modules (/api/gym, /api/trainer, /api/admin).
 */
const router = Router();

router.get('/member/overview', requireAuth, requireRole('MEMBER'), async (req, res) => {
  const memberships = await prisma.membership.count({ where: { memberId: req.user!.id } });
  res.json({ area: 'member', user: req.user, memberships });
});

export default router;
