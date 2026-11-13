import crypto from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import type { GymPhotoRow } from '@dive/shared';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { audit } from '../../lib/audit';
import { badRequest, notFound } from '../../lib/errors';
import type { Actor } from './gym.service';

export const UPLOAD_ROOT = path.resolve(process.cwd(), env.UPLOAD_DIR);
export const MAX_PHOTOS = 12;
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const toRow = (p: { id: string; url: string; caption: string | null; sortOrder: number }): GymPhotoRow => ({ id: p.id, url: p.url, caption: p.caption, sortOrder: p.sortOrder });

export async function listPhotos(gymId: string) {
  const rows = await prisma.gymPhoto.findMany({ where: { gymId }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
  return rows.map(toRow);
}

/**
 * Accepts the raw image bytes. Re-encodes through sharp (strips EXIF/GPS, normalises orientation,
 * rejects anything that isn't really an image) and stores a ≤1600px WebP.
 */
export async function addPhoto(gymId: string, bytes: Buffer, caption: string | null, actor: Actor) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) throw badRequest('Send the image file as the request body');
  if ((await prisma.gymPhoto.count({ where: { gymId } })) >= MAX_PHOTOS) throw badRequest(`A gym can have up to ${MAX_PHOTOS} photos. Delete one first.`);

  let out: Buffer;
  let meta: sharp.Metadata;
  try {
    meta = await sharp(bytes).metadata();
    if (!meta.width || !meta.height || !['jpeg', 'png', 'webp'].includes(meta.format ?? '')) throw new Error('format');
    out = await sharp(bytes).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  } catch {
    throw badRequest('That file is not a JPEG, PNG or WebP image');
  }
  if (meta.width < 600) throw badRequest('Photo is too small — use one at least 600 px wide');

  const name = `${crypto.randomUUID()}.webp`;
  const dir = path.join(UPLOAD_ROOT, 'gyms', gymId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), out);

  const max = await prisma.gymPhoto.aggregate({ where: { gymId }, _max: { sortOrder: true } });
  const p = await prisma.gymPhoto.create({ data: { gymId, url: `/uploads/gyms/${gymId}/${name}`, caption, sortOrder: (max._max.sortOrder ?? -1) + 1 } });
  await audit({ actorId: actor.id, actorRole: actor.role, ip: actor.ip ?? null, action: 'gym.photo_added', entity: 'gym_photo', entityId: p.id, gymId });
  return toRow(p);
}

export async function updatePhoto(gymId: string, id: string, caption: string | null) {
  const p = await prisma.gymPhoto.findFirst({ where: { id, gymId } });
  if (!p) throw notFound('Photo not found');
  return toRow(await prisma.gymPhoto.update({ where: { id }, data: { caption } }));
}

export async function deletePhoto(gymId: string, id: string, actor: Actor) {
  const p = await prisma.gymPhoto.findFirst({ where: { id, gymId } });
  if (!p) throw notFound('Photo not found');
  await prisma.gymPhoto.delete({ where: { id } });
  // Only delete files we uploaded (seed photos live in the client's public folder).
  if (p.url.startsWith(`/uploads/gyms/${gymId}/`)) {
    await unlink(path.join(UPLOAD_ROOT, 'gyms', gymId, path.basename(p.url))).catch((e: NodeJS.ErrnoException) => {
      // The row is gone, so the photo no longer shows anywhere; an orphan file is harmless but worth knowing about.
      if (e.code !== 'ENOENT') console.warn(`Could not delete ${p.url}: ${e.code}`);
    });
  }
  await audit({ actorId: actor.id, actorRole: actor.role, ip: actor.ip ?? null, action: 'gym.photo_deleted', entity: 'gym_photo', entityId: id, gymId });
}

export async function reorderPhotos(gymId: string, ids: string[]) {
  const owned = await prisma.gymPhoto.count({ where: { gymId, id: { in: ids } } });
  if (owned !== ids.length) throw badRequest('Unknown photo in list');
  await prisma.$transaction(ids.map((id, i) => prisma.gymPhoto.update({ where: { id }, data: { sortOrder: i } })));
  return listPhotos(gymId);
}
