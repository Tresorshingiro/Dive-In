import express, { Router, type Request } from 'express';
import { z } from 'zod';
import {
  availabilitySchema,
  bookingCreateSchema,
  cancelSchema,
  exceptionSchema,
  idempotencyKeySchema,
  messageSchema,
  startConversationSchema,
  trainerProfileSchema,
} from '@dive/shared';
import { badRequest } from '../../lib/errors';
import { optionalAuth, requireAuth, requireRole } from '../../middleware/auth';
import { validateBody, validateQuery } from '../../middleware/validate';
import * as coaching from './coaching.service';
import * as trainer from './trainer.service';

const key = (req: Request) => {
  const k = idempotencyKeySchema.safeParse(req.header('idempotency-key'));
  if (!k.success) throw badRequest(k.error.issues[0].message);
  return k.data;
};
const param = (req: Request, k: string) => String(req.params[k]);

/** /api/coaches — public coach profiles (full details only with an active pass). */
export const coachesRouter = Router();
coachesRouter.get('/:id', optionalAuth, async (req, res) => {
  res.json({ coach: await coaching.coachProfile(param(req, 'id'), req.user) });
});

/** /api/me/... coaching endpoints for members. */
export const memberCoachingRouter = Router();
memberCoachingRouter.use(requireAuth, requireRole('MEMBER'));
memberCoachingRouter.get('/coach-pass', async (req, res) => res.json({ pass: await coaching.passStatus(req.user!.id) }));
memberCoachingRouter.post('/coach-pass/checkout', async (req, res) => {
  const r = await coaching.buyPass({ ...req.user!, role: 'MEMBER' }, key(req));
  res.status(201).json({ paymentId: r.paymentId, redirectUrl: r.redirectUrl });
});
memberCoachingRouter.get('/bookings', async (req, res) => res.json({ bookings: await coaching.myBookings(req.user!.id) }));
memberCoachingRouter.post('/bookings', validateBody(bookingCreateSchema), async (req, res) => {
  res.status(201).json(await coaching.book({ ...req.user!, role: 'MEMBER' }, req.body.trainerId, req.body.startsAt, req.body.note, key(req)));
});
memberCoachingRouter.post('/bookings/:id/cancel', validateBody(cancelSchema), async (req, res) => {
  await coaching.cancelMyBooking(req.user!.id, param(req, 'id'), req.body.reason);
  res.status(204).end();
});

/** /api/messages — member ↔ trainer. */
export const messagesRouter = Router();
messagesRouter.use(requireAuth, requireRole('MEMBER', 'TRAINER'));
messagesRouter.get('/', async (req, res) => res.json({ conversations: await coaching.conversations(req.user!) }));
messagesRouter.post('/', requireRole('MEMBER'), validateBody(startConversationSchema), async (req, res) => {
  res.status(201).json({ conversationId: await coaching.startConversation({ ...req.user!, role: 'MEMBER' }, req.body.trainerId, req.body.body) });
});
messagesRouter.get('/:id', async (req, res) => res.json({ messages: await coaching.thread(req.user!, param(req, 'id')) }));
messagesRouter.post('/:id', validateBody(messageSchema), async (req, res) => {
  res.status(201).json({ message: await coaching.sendMessage(req.user!, param(req, 'id'), req.body.body) });
});

/** /api/trainer — the trainer's own workspace. */
export const trainerRouter = Router();
trainerRouter.use(requireAuth, requireRole('TRAINER'));
trainerRouter.get('/me', async (req, res) => res.json({ trainer: await trainer.self(req.user!.id) }));
trainerRouter.get('/overview', async (req, res) => res.json({ area: 'trainer', overview: await trainer.overview(req.user!.id) }));
trainerRouter.put('/profile', validateBody(trainerProfileSchema), async (req, res) => res.json({ trainer: await trainer.updateProfile(req.user!.id, req.body) }));
trainerRouter.post('/photo', express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: 8 * 1024 * 1024 }), async (req, res) => {
  if (!Buffer.isBuffer(req.body)) throw badRequest('Upload a JPEG, PNG or WebP image');
  res.status(201).json({ photoUrl: await trainer.setPhoto(req.user!.id, req.body) });
});
trainerRouter.get('/availability', async (req, res) => res.json(await trainer.getAvailability(req.user!.id)));
trainerRouter.put('/availability', validateBody(availabilitySchema), async (req, res) => res.json(await trainer.setAvailability(req.user!.id, req.body)));
trainerRouter.post('/days-off', validateBody(exceptionSchema), async (req, res) => res.status(201).json(await trainer.addDayOff(req.user!.id, req.body.date, req.body.note)));
trainerRouter.delete('/days-off/:id', async (req, res) => res.json(await trainer.removeDayOff(req.user!.id, param(req, 'id'))));
trainerRouter.get('/sessions', validateQuery(z.object({ scope: z.enum(['upcoming', 'past']).default('upcoming') })), async (req, res) => {
  res.json({ sessions: await trainer.sessions(req.user!.id, (res.locals.query as { scope: 'upcoming' | 'past' }).scope) });
});
trainerRouter.post('/sessions/:id/complete', async (req, res) => {
  await trainer.completeSession(req.user!.id, param(req, 'id'));
  res.status(204).end();
});
trainerRouter.post('/sessions/:id/cancel', validateBody(cancelSchema), async (req, res) => {
  await trainer.cancelSession(req.user!.id, param(req, 'id'), req.body.reason);
  res.status(204).end();
});
