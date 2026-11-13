import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';

type Db = Prisma.TransactionClient | typeof prisma;

export async function notify(userId: string, n: { type: string; title: string; body?: string; link?: string }, db: Db = prisma) {
  await db.notification.create({ data: { userId, type: n.type, title: n.title, body: n.body ?? null, link: n.link ?? null } });
}
