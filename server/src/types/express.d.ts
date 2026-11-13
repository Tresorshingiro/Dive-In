import type { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth / optionalAuth. */
      user?: { id: string; role: Role; email: string; fullName: string };
      /** Set by requireGymScope: the one gym this owner/receptionist may act on. */
      gymScope?: { gymId: string; as: 'OWNER' | 'RECEPTIONIST' };
    }
  }
}

export {};
