import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { db } from '../../lib/db.js';
import { HttpError } from '../../lib/errors.js';
import { env } from '../../config/env.js';

export const authRouter = Router();
authRouter.post('/login', async (req, res) => {
  const body = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
  const user = await db.user.findUnique({ where: { email: body.email.trim().toLowerCase() } });
  if (!user || !user.active || !(await bcrypt.compare(body.password, user.passwordHash))) throw new HttpError(401, 'Email or password is incorrect');
  try { await db.activityLog.create({ data: { userId: user.id, action: 'auth.login', entityType: 'User', entityId: user.id, ipAddress: req.ip } }); }
  catch (error) { console.error('Could not write login activity log', error); }
  const token = jwt.sign({ role: user.role }, env.JWT_SECRET, { subject: user.id, expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});
