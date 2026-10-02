import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { HttpError } from '../lib/errors.js';
import { db } from '../lib/db.js';

declare global {
  namespace Express { interface Request { user?: { id: string; role: 'ADMIN' | 'MANAGER' | 'RECEPTIONIST' | 'HOUSEKEEPING' } } }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) throw new HttpError(401, 'Sign in to continue');
    const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string };
    if (typeof payload.sub !== 'string') throw new HttpError(401, 'Invalid or expired session');
    void db.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true, active: true } }).then(user => {
      if (!user || !user.active) return next(new HttpError(401, 'This account is no longer active'));
      req.user = { id: user.id, role: user.role };
      next();
    }).catch(next);
  } catch (error) { next(error instanceof HttpError ? error : new HttpError(401, 'Invalid or expired session')); }
}

export function allowRoles(...roles: NonNullable<Request['user']>['role'][]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) return next(new HttpError(403, 'You do not have access to this action'));
    next();
  };
}
