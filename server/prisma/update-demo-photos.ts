/**
 * Refreshes the demo gyms' and coaches' photos WITHOUT wiping the database.
 * Only touches built-in demo images (/images/...); photos uploaded through the portal are kept.
 * Run: npm run db:photos
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const GYM_PHOTOS: Record<string, string[]> = {
  'iron-house': ['gym-1', 'gym-7', 'gym-11'],
  'pulse-studio': ['gym-9', 'gym-3'],
  'summit-strength': ['gym-6', 'gym-7', 'gym-2'],
  'hilltop-fitness': ['gym-5', 'gym-4'],
  'core-lab': ['gym-8', 'gym-3'],
  'motion-club': ['gym-10', 'gym-2'],
  'kibagabaga-body-works': ['gym-2'],
};

const TRAINER_PHOTOS: Record<string, string> = {
  'trainer@demo.dive.rw': 'coach-1',
  'aline@demo.dive.rw': 'coach-2',
  'jeanpaul@demo.dive.rw': 'coach-3',
  'patrick@demo.dive.rw': 'coach-4',
  'olivier@demo.dive.rw': 'coach-5',
  'trainer.pending@demo.dive.rw': 'coach-6',
};

async function main() {
  let gyms = 0;
  for (const [slug, photos] of Object.entries(GYM_PHOTOS)) {
    const gym = await prisma.gym.findUnique({ where: { slug }, include: { photos: { orderBy: { sortOrder: 'asc' } } } });
    if (!gym) continue;
    const uploaded = gym.photos.filter((p) => !p.url.startsWith('/images/'));
    await prisma.$transaction([
      prisma.gymPhoto.deleteMany({ where: { gymId: gym.id, url: { startsWith: '/images/' } } }),
      ...photos.map((p, i) => prisma.gymPhoto.create({ data: { gymId: gym.id, url: `/images/${p}.webp`, caption: i === 0 ? `${gym.name} gym floor` : null, sortOrder: i } })),
      // owner uploads keep their order, after the demo photos
      ...uploaded.map((p, i) => prisma.gymPhoto.update({ where: { id: p.id }, data: { sortOrder: photos.length + i } })),
    ]);
    gyms++;
  }
  let trainers = 0;
  for (const [email, photo] of Object.entries(TRAINER_PHOTOS)) {
    // Only replace empty or built-in photos, never one the trainer uploaded.
    const r = await prisma.trainer.updateMany({
      where: { user: { email }, OR: [{ photoUrl: null }, { photoUrl: { startsWith: '/images/' } }] },
      data: { photoUrl: `/images/${photo}.webp` },
    });
    trainers += r.count;
  }
  console.log(`Updated photos for ${gyms} gyms and ${trainers} coaches.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
