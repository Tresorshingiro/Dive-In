import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny, z } from 'zod';
import { fieldErrors } from '@dive/shared';
import { badRequest } from '../lib/errors';

/** Validates req.body and replaces it with the parsed value. */
export function validateBody<S extends ZodTypeAny>(schema: S) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const r = schema.safeParse(req.body);
    if (!r.success) throw badRequest('Please check the highlighted fields', fieldErrors(r.error));
    req.body = r.data as z.infer<S>;
    next();
  };
}

/** Parses req.query into res.locals.query (Express 5 makes req.query read-only). */
export function validateQuery<S extends ZodTypeAny>(schema: S) {
  return (req: Request, res: Response, next: NextFunction) => {
    const r = schema.safeParse(req.query);
    if (!r.success) throw badRequest('Invalid query', fieldErrors(r.error));
    res.locals.query = r.data as z.infer<S>;
    next();
  };
}
