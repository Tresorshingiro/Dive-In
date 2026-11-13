import express, { Router } from 'express';
import { WebhookSignatureError } from '../../payments/PaymentProvider';
import { handleWebhook } from './payments.service';

/**
 * Provider → server callbacks. Mounted BEFORE express.json(): signature checks need the exact raw bytes.
 * Authenticated by the provider's signature, not by cookies.
 */
const router = Router();

router.post('/:provider', express.raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
  const provider = req.params.provider;
  if (provider !== 'stripe' && provider !== 'mock') return res.status(404).end();
  try {
    const result = await handleWebhook(provider, req.body as Buffer, req.headers);
    res.json({ received: true, result });
  } catch (e) {
    if (e instanceof WebhookSignatureError) {
      console.warn(`Rejected ${provider} webhook: ${e.message}`);
      return res.status(400).json({ error: { code: 'BAD_SIGNATURE', message: 'Invalid webhook signature' } });
    }
    console.error('webhook processing failed', e);
    // 500 → the provider retries later; the event table makes the retry safe.
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Webhook processing failed' } });
  }
});

export default router;
