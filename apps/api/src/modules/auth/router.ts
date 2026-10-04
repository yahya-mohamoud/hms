import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { db } from '../../lib/db.js';
import { HttpError } from '../../lib/errors.js';
import { env } from '../../config/env.js';
import { allowRoles, authenticate } from '../../middleware/auth.js';
import { logActivity } from '../../lib/audit.js';

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
  const body = z.object({ email: z.string().email(), recoveryPhrase: z.string().min(1), newPassword: z.string().min(10).max(200) }).parse(req.body);
  const user = await db.user.findUnique({ where: { email: body.email.trim().toLowerCase() } });
  if (!user || !user.active || user.role !== 'ADMIN' || !user.adminRecoveryPhraseHash || !(await bcrypt.compare(body.recoveryPhrase.trim(), user.adminRecoveryPhraseHash))) throw new HttpError(401, 'Recovery details are incorrect');
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(body.newPassword, 12) } });
  await logActivity(req, 'auth.admin_password_reset', 'User', user.id);
  res.json({ message: 'Administrator password reset. Sign in with the new password.' });
});

authRouter.post('/admin/recovery-phrase', authenticate, allowRoles('ADMIN'), async (req, res) => {
  const body = z.object({ currentPassword: z.string().min(1), recoveryPhrase: z.string().trim().min(12).max(200) }).parse(req.body);
  const user = await db.user.findUnique({ where: { id: req.user!.id } });
  if (!user || !(await bcrypt.compare(body.currentPassword, user.passwordHash))) throw new HttpError(401, 'Current password is incorrect');
  await db.user.update({ where: { id: user.id }, data: { adminRecoveryPhraseHash: await bcrypt.hash(body.recoveryPhrase, 12) } });
  await logActivity(req, 'auth.admin_recovery_phrase_updated', 'User', user.id);
  res.json({ message: 'Administrator recovery passphrase saved.' });
});
