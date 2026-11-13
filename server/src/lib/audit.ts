import type { Prisma, Role } from '@prisma/client';
import type { Request } from 'express';
import { prisma } from './prisma';

type Db = Prisma.TransactionClient | typeof prisma;

export interface AuditEntry {
  actorId?: string | null;
  actorRole?: Role | null;
  action: string;
  entity?: string;
  entityId?: string;
  gymId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}

/** Writes one audit row. Pass a transaction client to keep it atomic with the change. */
export async function audit(entry: AuditEntry, db: Db = prisma) {
  await db.auditLog.create({
    data: {
      actorId: entry.actorId ?? null,
      actorRole: entry.actorRole ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      gymId: entry.gymId ?? null,
      before: (entry.before ?? undefined) as Prisma.InputJsonValue | undefined,
      after: (entry.after ?? undefined) as Prisma.InputJsonValue | undefined,
      ip: entry.ip ?? null,
    },
  });
}

/** Actor fields from an authenticated request. */
export function actorOf(req: Request) {
  return { actorId: req.user?.id ?? null, actorRole: req.user?.role ?? null, ip: req.ip ?? null };
}
