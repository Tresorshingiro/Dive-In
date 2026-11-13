import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { contactSchema, type ContactInput } from '@dive/shared';
import { prisma } from '../../lib/prisma';
import { validateBody } from '../../middleware/validate';

const router = Router();

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many messages. Please try again later.' } },
});

router.post('/', limiter, validateBody(contactSchema), async (req, res) => {
  const body = req.body as ContactInput;
  // Honeypot filled → pretend success, store nothing.
  if (body.website) return res.status(201).json({ ok: true });
  await prisma.contactMessage.create({
    data: {
      name: body.name,
      email: body.email,
      phone: body.phone ?? null,
      role: body.role,
      gymName: body.role === 'GYM_OWNER' ? body.gymName : null,
      neighbourhood: body.role === 'GYM_OWNER' ? body.neighbourhood : null,
      message: body.message,
      ip: req.ip ?? null,
    },
  });
  res.status(201).json({ ok: true });
});

export default router;
