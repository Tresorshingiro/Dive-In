import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { gymListQuerySchema, trainerListQuerySchema, type GymListQuery, type GymSummary, type TrainerSummary } from '@dive/shared';
import { prisma } from '../../lib/prisma';
import { notFound } from '../../lib/errors';
import { getPublicConfig } from '../../lib/platformConfig';
import { validateQuery } from '../../middleware/validate';

const router = Router();

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Only approved gyms are public. */
const PUBLIC_GYM: Prisma.GymWhereInput = { status: 'APPROVED' };

router.get('/config', async (_req, res) => {
  res.json(await getPublicConfig());
});

router.get('/gyms', validateQuery(gymListQuerySchema), async (_req, res) => {
  const q = res.locals.query as GymListQuery;
  const where: Prisma.GymWhereInput = {
    ...PUBLIC_GYM,
    ...(q.neighbourhood ? { neighbourhood: q.neighbourhood } : {}),
    ...(q.q
      ? {
          OR: [
            { name: { contains: q.q, mode: 'insensitive' } },
            { neighbourhood: { contains: q.q, mode: 'insensitive' } },
            { tags: { has: q.q } },
          ],
        }
      : {}),
  };
  const gyms = await prisma.gym.findMany({
    where,
    take: 50,
    orderBy: { name: 'asc' },
    include: {
      photos: { orderBy: { sortOrder: 'asc' }, take: 1 },
      packages: { where: { active: true }, select: { priceRwf: true, durationDays: true } },
    },
  });

  let out: GymSummary[] = gyms.map((g) => {
    const monthly = g.packages.filter((p) => p.durationDays >= 28 && p.durationDays <= 31).map((p) => p.priceRwf);
    const all = g.packages.map((p) => p.priceRwf);
    const prices = monthly.length ? monthly : all;
    const lat = Number(g.lat ?? 0);
    const lng = Number(g.lng ?? 0);
    return {
      id: g.id,
      slug: g.slug,
      name: g.name,
      neighbourhood: g.neighbourhood,
      tags: g.tags,
      lat,
      lng,
      coverUrl: g.photos[0]?.url ?? null,
      fromPriceRwf: prices.length ? Math.min(...prices) : null,
      verified: g.status === 'APPROVED',
      ...(q.lat !== undefined && q.lng !== undefined ? { distanceKm: Math.round(haversineKm({ lat: q.lat, lng: q.lng }, { lat, lng }) * 10) / 10 } : {}),
    };
  });
  if (q.lat !== undefined && q.lng !== undefined) out.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  out = out.slice(0, q.limit);
  res.json({ gyms: out });
});

router.get('/gyms/:slug', async (req, res) => {
  const g = await prisma.gym.findFirst({
    where: { ...PUBLIC_GYM, slug: req.params.slug },
    include: {
      photos: { orderBy: { sortOrder: 'asc' } },
      packages: { where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { priceRwf: 'asc' }] },
      trainers: {
        where: { trainer: { verificationStatus: 'VERIFIED' } },
        include: { trainer: { include: { user: { select: { fullName: true } } } } },
      },
    },
  });
  if (!g) throw notFound('Gym not found');
  res.json({
    gym: {
      id: g.id,
      slug: g.slug,
      name: g.name,
      description: g.description,
      neighbourhood: g.neighbourhood,
      address: g.address,
      lat: Number(g.lat ?? 0),
      lng: Number(g.lng ?? 0),
      phone: g.phone,
      openingHours: g.openingHours,
      tags: g.tags,
      amenities: g.amenities,
      diveCheckoutEnabled: g.diveCheckoutEnabled,
      photos: g.photos.map((p) => ({ url: p.url, caption: p.caption })),
      packages: g.packages.map((p) => ({ id: p.id, name: p.name, description: p.description, durationDays: p.durationDays, priceRwf: p.priceRwf, perks: p.perks })),
      // basic coach info only — the full profile needs a Coach Access Pass
      trainers: g.trainers.map(({ trainer: t }) => ({ id: t.id, fullName: t.user.fullName, photoUrl: t.photoUrl, headline: t.headline, specialties: t.specialties })),
    },
  });
});

router.get('/trainers', validateQuery(trainerListQuerySchema), async (_req, res) => {
  const q = res.locals.query as { q?: string; limit: number };
  const trainers = await prisma.trainer.findMany({
    where: {
      verificationStatus: 'VERIFIED',
      ...(q.q
        ? { OR: [{ user: { fullName: { contains: q.q, mode: 'insensitive' } } }, { specialties: { has: q.q } }] }
        : {}),
    },
    take: q.limit,
    orderBy: { createdAt: 'asc' },
    include: {
      user: { select: { fullName: true } },
      gyms: { where: { gym: PUBLIC_GYM }, include: { gym: { select: { name: true, neighbourhood: true } } } },
    },
  });
  // Free profile only: no bio, fee, availability or contact details.
  const out: TrainerSummary[] = trainers.map((t) => ({
    id: t.id,
    fullName: t.user.fullName,
    photoUrl: t.photoUrl,
    headline: t.headline,
    specialties: t.specialties,
    gyms: t.gyms.map((tg) => ({ name: tg.gym.name, neighbourhood: tg.gym.neighbourhood })),
    verified: true,
  }));
  res.json({ trainers: out });
});

export default router;
