import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export function slugify(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'gym';
}

/** "iron-house", then "iron-house-2", ... */
export async function uniqueGymSlug(name: string, db: Prisma.TransactionClient | typeof prisma = prisma) {
  const base = slugify(name);
  let slug = base;
  for (let i = 2; await db.gym.findUnique({ where: { slug }, select: { id: true } }); i++) slug = `${base}-${i}`;
  return slug;
}
