import { Router } from 'express';
import { z } from 'zod';
import { formatRwf } from '@dive/shared';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { notFound } from '../../lib/errors';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { getMockProvider } from '../../payments';
import { handleWebhook } from './payments.service';

/**
 * The mock provider's "hosted payment page" backend. Only mounted when PAYMENT_PROVIDER=mock
 * and not in production. Completing a payment here produces a signed webhook that goes through
 * exactly the same verification path as Stripe's.
 */
const router = Router();
router.use(requireAuth);

async function loadOwn(userId: string, id: string) {
  const p = await prisma.payment.findFirst({ where: { id, userId, provider: 'mock' } });
  if (!p || !p.providerRef) throw notFound('Mock payment not found');
  return p;
}

router.get('/:id', async (req, res) => {
  const p = await loadOwn(req.user!.id, String(req.params.id));
  res.json({ id: p.id, status: p.status, amount: formatRwf(p.amountRwf) });
});

router.post('/:id/complete', validateBody(z.object({ outcome: z.enum(['success', 'fail']) })), async (req, res) => {
  const p = await loadOwn(req.user!.id, String(req.params.id));
  const { body, headers } = getMockProvider().complete(p.providerRef!, req.body.outcome);
  const result = await handleWebhook('mock', body, headers);
  res.json({ result, returnUrl: `${env.CLIENT_URL}/app/checkout/return?payment=${p.id}` });
});

export default router;
