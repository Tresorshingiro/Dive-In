import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { env, isProd } from './config/env';
import { originCheck } from './middleware/originCheck';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import authRoutes from './modules/auth/auth.routes';
import publicRoutes from './modules/public/public.routes';
import contactRoutes from './modules/contact/contact.routes';
import portalRoutes from './modules/portal/portal.routes';
import memberRoutes from './modules/member/member.routes';
import webhookRoutes from './modules/payments/webhooks.routes';
import mockPayRoutes from './modules/payments/mockpay.routes';
import gymRoutes from './modules/gym/gym.routes';
import adminRoutes from './modules/admin/admin.routes';
import accountRoutes from './modules/account/account.routes';
import { coachesRouter, memberCoachingRouter, messagesRouter, trainerRouter } from './modules/coaching/coaching.routes';
import { UPLOAD_ROOT } from './modules/gym/photos.service';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // same-site: dive.rw may load images from api.dive.rw
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cors({ origin: env.CLIENT_URL, credentials: true }));

  // Uploaded gym photos (file names are random UUIDs, so they can be cached forever).
  app.use('/uploads', express.static(UPLOAD_ROOT, { immutable: true, maxAge: '365d', index: false }));
  app.use('/uploads', (_req, res) => res.status(404).end());

  // Webhooks first: they need the raw body and authenticate by signature.
  app.use('/api/webhooks', webhookRoutes);

  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use('/api', originCheck);

  app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString(), payments: env.PAYMENT_PROVIDER }));
  app.use('/api/auth', authRoutes);
  app.use('/api/contact', contactRoutes);
  app.use('/api/me', memberRoutes);
  app.use('/api/me', memberCoachingRouter);
  app.use('/api/gym', gymRoutes);
  app.use('/api/trainer', trainerRouter);
  app.use('/api/coaches', coachesRouter);
  app.use('/api/messages', messagesRouter);
  app.use('/api/admin', adminRoutes);
  if (env.PAYMENT_PROVIDER === 'mock' && !isProd) app.use('/api/payments/mock', mockPayRoutes);
  app.use('/api', accountRoutes);
  app.use('/api', publicRoutes);
  app.use('/api', portalRoutes);

  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
}
