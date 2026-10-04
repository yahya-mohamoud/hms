import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../../lib/db.js';
import { allowRoles } from '../../middleware/auth.js';
import { HttpError } from '../../lib/errors.js';
import { logActivity } from '../../lib/audit.js';

export const usersRouter = Router();
usersRouter.use(allowRoles('ADMIN'));
usersRouter.get('/', async (_req, res) => res.json(await db.user.findMany({ select: { id: true, name: true, email: true, role: true, active: true, createdAt: true }, orderBy: { name: 'asc' } })));
usersRouter.post('/', allowRoles('ADMIN'), async (req, res) => {
  const d = z.object({ name: z.string().min(1).max(100), email: z.string().email(), password: z.string().min(10), role: z.enum(['ADMIN','MANAGER','RECEPTIONIST']) }).parse(req.body);
  const user = await db.user.create({ data: { name: d.name, email: d.email.toLowerCase(), role: d.role, passwordHash: await bcrypt.hash(d.password, 12) }, select: { id: true, name: true, email: true, role: true, active: true } });
  await logActivity(req, 'user.created', 'User', user.id, { role: user.role });
  res.status(201).json(user);
});
usersRouter.patch('/:id', allowRoles('ADMIN'), async (req, res) => {
  const d = z.object({ name: z.string().min(1).max(100).optional(), role: z.enum(['ADMIN','MANAGER','RECEPTIONIST','HOUSEKEEPING']).optional(), active: z.boolean().optional(), password: z.string().min(10).optional() }).parse(req.body);
  if (String(req.params.id) === req.user?.id && d.active === false) throw new HttpError(400, 'You cannot disable your own account');
  const { password, ...rest } = d;
  const user = await db.user.update({ where: { id: String(req.params.id) }, data: { ...rest, ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}) }, select: { id: true, name: true, email: true, role: true, active: true } });
  await logActivity(req, 'user.updated', 'User', user.id, { fields: Object.keys(d) });
  res.json(user);
});
usersRouter.delete('/:id', async (req, res) => {
  const userId = String(req.params.id);
  if (userId === req.user?.id) throw new HttpError(400, 'You cannot delete your own account');
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, role: true } });
  if (!user) throw new HttpError(404, 'User not found');
  if (user.role === 'ADMIN') throw new HttpError(409, 'Administrator accounts cannot be deleted here');
  await db.user.delete({ where: { id: user.id } });
  await logActivity(req, 'user.deleted', 'User', user.id, { email: user.email, role: user.role });
  res.json({ deleted: true });
});
