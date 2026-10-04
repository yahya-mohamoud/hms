import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { db } from '../../lib/db.js';
import { HttpError } from '../../lib/errors.js';
import { env } from '../../config/env.js';

export const authRouter = Router();
authRouter.post('/login', async (req, res) => {
  const body = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
  const user = await db.user.findUnique({ where: { email: body.email.trim().toLowerCase() } });
  if (!user || !user.active || !(await bcrypt.compare(body.password, user.passwordHash))) throw new HttpError(401, 'Email or password is incorrect');
  if (user.role === 'HOUSEKEEPING') throw new HttpError(403, 'Worker accounts do not sign in to this system. Contact the administrator.');
  try { await db.activityLog.create({ data: { userId: user.id, action: 'auth.login', entityType: 'User', entityId: user.id, ipAddress: req.ip } }); }
  catch (error) { console.error('Could not write login activity log', error); }
  const token = jwt.sign({ role: user.role }, env.JWT_SECRET, { subject: user.id, expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

authRouter.post('/admin/forgot-password', async (req, res) => {
  const body = z.object({ email: z.string().email(), recoveryKey: z.string().min(1), newPassword: z.string().min(10).max(200) }).parse(req.body);
  const configuredKey = env.ADMIN_RECOVERY_KEY;
  if (!configuredKey) throw new HttpError(503, 'Admin password recovery is not configured on this server');
  const suppliedHash = createHash('sha256').update(body.recoveryKey).digest();
  const configuredHash = createHash('sha256').update(configuredKey).digest();
  if (!timingSafeEqual(suppliedHash, configuredHash)) throw new HttpError(401, 'Recovery details are incorrect');
  const user = await db.user.findUnique({ where: { email: body.email.trim().toLowerCase() } });
  if (!user || !user.active || user.role !== 'ADMIN') throw new HttpError(401, 'Recovery details are incorrect');
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(body.newPassword, 12) } });
  try {
    await db.activityLog.create({ data: { userId: user.id, action: 'auth.admin_password_reset', entityType: 'User', entityId: user.id, ipAddress: req.ip } });
  } catch (error) { console.error('Could not write admin password reset activity log', error); }
  res.json({ message: 'Administrator password reset. Sign in with the new password.' });
});
