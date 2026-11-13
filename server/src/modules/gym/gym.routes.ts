import express, { Router, type Request } from 'express';
import { z } from 'zod';
import {
  gymProfileSchema,
  idempotencyKeySchema,
  linkTrainerSchema,
  memberListQuerySchema,
  packageSchema,
  receptionSearchSchema,
  recordGymPaymentSchema,
  reorderSchema,
  staffCreateSchema,
  subscriptionCheckoutSchema,
} from '@dive/shared';
import * as subscription from './subscription.service';
import { badRequest } from '../../lib/errors';
import { requireAuth, requireRole } from '../../middleware/auth';
import { requireGymScope } from '../../middleware/gymScope';
import { validateBody, validateQuery } from '../../middleware/validate';
import * as gym from './gym.service';
import * as photos from './photos.service';
import * as reception from './reception.service';
import * as reports from './reports.service';
import { kigaliDayStart } from '../../lib/time';

/**
 * /api/gym — the gym portal. Every handler works on req.gymScope.gymId only.
 * Reception: context, overview (no money), reception search + check-in. Everything else: owner only.
 */
const router = Router();
router.use(requireAuth, requireRole('GYM_OWNER', 'RECEPTIONIST'));

const gymId = (req: Request) => req.gymScope!.gymId;
const actor = (req: Request): gym.Actor => ({ id: req.user!.id, role: req.user!.role, ip: req.ip ?? null });
const ownerOnly = requireGymScope(['OWNER']);
const anyStaff = requireGymScope();
const param = (req: Request, k: string) => String(req.params[k]);

// The owner's gyms (for the gym switcher). No scope needed.
router.get('/mine', requireRole('GYM_OWNER'), async (req, res) => {
  res.json({ gyms: await gym.ownedGyms(req.user!.id) });
});

router.get('/context', anyStaff, async (req, res) => {
  res.json({ gym: await gym.context(gymId(req), req.gymScope!.as) });
});

router.get('/overview', anyStaff, async (req, res) => {
  res.json({ area: 'gym', as: req.gymScope!.as, gym: await gym.context(gymId(req), req.gymScope!.as), overview: await gym.overview(gymId(req), req.gymScope!.as) });
});

// ── reception desk (owner + receptionist) ──
router.get('/reception/search', anyStaff, validateQuery(receptionSearchSchema), async (req, res) => {
  res.json({ results: await reception.search(gymId(req), (res.locals.query as { q: string }).q) });
});

router.post('/reception/check-in', anyStaff, validateBody(z.object({ membershipId: z.string().uuid() })), async (req, res) => {
  const outcome = await reception.checkIn(gymId(req), req.user!, req.body.membershipId, req.ip);
  res.status(outcome.duplicate ? 200 : 201).json(outcome);
});

router.get('/reception/today', anyStaff, async (req, res) => {
  res.json({ checkIns: await reception.recentCheckIns(gymId(req), kigaliDayStart(), 100) });
});

// ── owner: profile ──
router.get('/profile', ownerOnly, async (req, res) => res.json({ profile: await gym.getProfile(gymId(req)) }));
router.put('/profile', ownerOnly, validateBody(gymProfileSchema), async (req, res) => {
  res.json({ profile: await gym.updateProfile(gymId(req), req.body, actor(req)) });
});

// ── owner: photos ──
router.get('/photos', ownerOnly, async (req, res) => res.json({ photos: await photos.listPhotos(gymId(req)) }));
router.post(
  '/photos',
  ownerOnly,
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: photos.MAX_UPLOAD_BYTES }),
  async (req, res) => {
    if (!Buffer.isBuffer(req.body)) throw badRequest('Upload a JPEG, PNG or WebP image');
    const caption = typeof req.query.caption === 'string' ? req.query.caption.trim().slice(0, 120) || null : null;
    res.status(201).json({ photo: await photos.addPhoto(gymId(req), req.body, caption, actor(req)) });
  },
);
router.patch('/photos/:id', ownerOnly, validateBody(z.object({ caption: z.string().trim().max(120).nullable() })), async (req, res) => {
  res.json({ photo: await photos.updatePhoto(gymId(req), param(req, 'id'), req.body.caption || null) });
});
router.delete('/photos/:id', ownerOnly, async (req, res) => {
  await photos.deletePhoto(gymId(req), param(req, 'id'), actor(req));
  res.status(204).end();
});
router.put('/photos/order', ownerOnly, validateBody(reorderSchema), async (req, res) => {
  res.json({ photos: await photos.reorderPhotos(gymId(req), req.body.ids) });
});

// ── owner: packages ──
router.get('/packages', ownerOnly, async (req, res) => res.json({ packages: await gym.listPackages(gymId(req)) }));
router.post('/packages', ownerOnly, validateBody(packageSchema), async (req, res) => {
  await gym.createPackage(gymId(req), req.body, actor(req));
  res.status(201).json({ packages: await gym.listPackages(gymId(req)) });
});
router.put('/packages/order', ownerOnly, validateBody(reorderSchema), async (req, res) => {
  await gym.reorderPackages(gymId(req), req.body.ids);
  res.json({ packages: await gym.listPackages(gymId(req)) });
});
router.put('/packages/:id', ownerOnly, validateBody(packageSchema), async (req, res) => {
  await gym.updatePackage(gymId(req), param(req, 'id'), req.body, actor(req));
  res.json({ packages: await gym.listPackages(gymId(req)) });
});
router.delete('/packages/:id', ownerOnly, async (req, res) => {
  await gym.deletePackage(gymId(req), param(req, 'id'), actor(req));
  res.status(204).end();
});

// ── owner: members ──
router.get('/members', ownerOnly, validateQuery(memberListQuerySchema), async (req, res) => {
  res.json(await gym.listMembers(gymId(req), res.locals.query, true));
});
router.get('/members/:id', ownerOnly, async (req, res) => res.json(await gym.memberDetail(gymId(req), param(req, 'id'))));
router.post('/members/:id/payments', ownerOnly, validateBody(recordGymPaymentSchema), async (req, res) => {
  const key = idempotencyKeySchema.safeParse(req.header('idempotency-key'));
  if (!key.success) throw badRequest(key.error.issues[0].message);
  const r = await gym.recordGymPayment(gymId(req), param(req, 'id'), req.body.packageId, key.data, req.body.note, actor(req));
  res.status(r.duplicate ? 200 : 201).json(r);
});
router.post('/members/:id/cancel', ownerOnly, validateBody(z.object({ reason: z.string().trim().max(200).optional() })), async (req, res) => {
  await gym.cancelMembership(gymId(req), param(req, 'id'), req.body.reason, actor(req));
  res.status(204).end();
});

// ── owner: trainers ──
router.get('/trainers', ownerOnly, async (req, res) => res.json({ trainers: await gym.listTrainers(gymId(req)) }));
router.post('/trainers', ownerOnly, validateBody(linkTrainerSchema), async (req, res) => {
  await gym.linkTrainer(gymId(req), req.body.email, actor(req));
  res.status(201).json({ trainers: await gym.listTrainers(gymId(req)) });
});
router.delete('/trainers/:trainerId', ownerOnly, async (req, res) => {
  await gym.unlinkTrainer(gymId(req), param(req, 'trainerId'), actor(req));
  res.status(204).end();
});

// ── owner: staff ──
router.get('/staff', ownerOnly, async (req, res) => res.json({ staff: await gym.listStaff(gymId(req)) }));
router.post('/staff', ownerOnly, validateBody(staffCreateSchema), async (req, res) => {
  res.status(201).json(await gym.createStaff(gymId(req), req.body, actor(req)));
});
router.post('/staff/:id/deactivate', ownerOnly, async (req, res) => {
  await gym.setStaffActive(gymId(req), param(req, 'id'), false, actor(req));
  res.status(204).end();
});
router.post('/staff/:id/reactivate', ownerOnly, async (req, res) => {
  await gym.setStaffActive(gymId(req), param(req, 'id'), true, actor(req));
  res.status(204).end();
});
router.post('/staff/:id/reset-password', ownerOnly, async (req, res) => {
  res.json(await gym.resetStaffPassword(gymId(req), param(req, 'id'), actor(req)));
});

// ── owner: payments & reports ──
router.get('/reports', ownerOnly, async (req, res) => res.json({ report: await reports.report(gymId(req)) }));
router.get('/payments', ownerOnly, async (req, res) => res.json({ payments: await reports.payments(gymId(req)) }));
router.get('/payments.csv', ownerOnly, async (req, res) => {
  const csv = await reports.paymentsCsv(gymId(req));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="dive-payments-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send('﻿' + csv); // BOM so Excel reads UTF-8
});
router.get('/activity', ownerOnly, async (req, res) => res.json({ activity: await reports.activity(gymId(req)) }));

// ── owner: DIVE-IN partner plan ──
router.get('/subscription', ownerOnly, async (req, res) => res.json({ subscription: await subscription.view(gymId(req)) }));
router.post('/subscription/checkout', ownerOnly, validateBody(subscriptionCheckoutSchema), async (req, res) => {
  const key = idempotencyKeySchema.safeParse(req.header('idempotency-key'));
  if (!key.success) throw badRequest(key.error.issues[0].message);
  const r = await subscription.checkout(gymId(req), { id: req.user!.id, email: req.user!.email }, req.body.plan, key.data);
  res.status(201).json({ paymentId: r.paymentId, redirectUrl: r.redirectUrl });
});

// Phase 1 compatibility: owner-only finance summary
router.get('/finance', ownerOnly, async (req, res) => {
  const r = await reports.report(gymId(req));
  res.json({ area: 'gym-finance', gymId: gymId(req), revenueThisMonthRwf: r.revenueThisMonthRwf });
});

export default router;
