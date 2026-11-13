import { env } from './config/env';
import { createApp } from './app';
import { prisma } from './lib/prisma';

import { startSweeper } from './jobs/sweeper';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`DIVE-IN API listening on http://localhost:${env.PORT}  (${env.NODE_ENV}, payments: ${env.PAYMENT_PROVIDER})`);
  if (env.PAYMENT_PROVIDER === 'stripe' && !env.STRIPE_SECRET_KEY) console.warn('⚠ STRIPE_SECRET_KEY is empty — online checkout will return 503 until it is set.');
  if (env.PAYMENT_PROVIDER === 'stripe' && !env.STRIPE_WEBHOOK_SECRET)
    console.warn('⚠ STRIPE_WEBHOOK_SECRET is empty — run `stripe listen --forward-to localhost:4000/api/webhooks/stripe`. Payments are still verified when members return from checkout.');
});
const sweeper = startSweeper();

async function shutdown() {
  clearInterval(sweeper);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
