import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { forbidden, unauthorized } from '../lib/errors';

/**
 * Resolves the single gym the caller may act on and puts it on req.gymScope.
 * - GYM_OWNER: their gym (an owner with several gyms picks one with ?gymId= or the X-Gym-Id header).
 * - RECEPTIONIST: the gym of their active staff record. Nothing else.
 * Every gym-portal query must filter by req.gymScope.gymId, never by an id from the URL alone.
 *
 * @param allow which kinds of gym account may pass (default: both)
 */
export function requireGymScope(allow: Array<'OWNER' | 'RECEPTIONIST'> = ['OWNER', 'RECEPTIONIST']) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw unauthorized();

    if (req.user.role === 'GYM_OWNER' && allow.includes('OWNER')) {
      const wanted = (req.header('x-gym-id') ?? (req.query.gymId as string | undefined)) || undefined;
      const gym = await prisma.gym.findFirst({
        where: { ownerId: req.user.id, ...(wanted ? { id: wanted } : {}) },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (!gym) throw forbidden('No gym is linked to this account');
      req.gymScope = { gymId: gym.id, as: 'OWNER' };
      return next();
    }

    if (req.user.role === 'RECEPTIONIST' && allow.includes('RECEPTIONIST')) {
      const staff = await prisma.gymStaff.findUnique({
        where: { userId: req.user.id },
        select: { gymId: true, active: true },
      });
      if (!staff || !staff.active) throw forbidden('This staff account is not active');
      req.gymScope = { gymId: staff.gymId, as: 'RECEPTIONIST' };
      return next();
    }

    throw forbidden();
  };
}
