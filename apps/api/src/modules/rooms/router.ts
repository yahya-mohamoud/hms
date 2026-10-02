import { Router } from 'express';
import { RoomStatus } from '@prisma/client';
import { z } from 'zod';
import { db } from '../../lib/db.js';
import { HttpError } from '../../lib/errors.js';
import { logActivity } from '../../lib/audit.js';
import { allowRoles } from '../../middleware/auth.js';

export const roomsRouter = Router();
roomsRouter.get('/', async (req, res) => {
  const query = { where: { active: true }, orderBy: { number: 'asc' as const } };
  if (req.user?.role === 'HOUSEKEEPING') return void res.json(await db.room.findMany({ ...query, include: { stays: { where: { status: 'IN_HOUSE' }, select: { id: true } } } }));
  res.json(await db.room.findMany({ ...query, include: { stays: { where: { status: 'IN_HOUSE' }, include: { guest: true } } } }));
});
roomsRouter.patch('/:id/status', allowRoles('ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPING'), async (req, res) => {
  const { status, notes } = z.object({ status: z.nativeEnum(RoomStatus), notes: z.string().max(500).optional() }).parse(req.body);
  if (req.user?.role === 'HOUSEKEEPING' && !['DIRTY','CLEAN','INSPECTED','OUT_OF_ORDER'].includes(status)) throw new HttpError(403, 'Housekeeping can only update cleaning and maintenance room statuses');
  const room = await db.room.findUnique({ where: { id: req.params.id } });
  if (!room) throw new HttpError(404, 'Room not found');
  if (status === 'AVAILABLE' && await db.stay.findFirst({ where: { roomId: room.id, status: 'IN_HOUSE' } })) throw new HttpError(409, 'An occupied room cannot be marked available');
  const updated = await db.room.update({ where: { id: room.id }, data: { status, ...(notes === undefined ? {} : { notes }) } });
  await logActivity(req, 'room.status_updated', 'Room', room.id, { from: room.status, to: status });
  res.json(updated);
});
roomsRouter.patch('/:id', allowRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const body = z.object({ number: z.string().min(1).max(12).optional(), type: z.string().min(1).max(60).optional(), floor: z.number().int().optional(), capacity: z.number().int().min(1).max(12).optional(), baseRate: z.number().nonnegative().optional(), notes: z.string().max(1000).nullable().optional() }).parse(req.body);
  res.json(await db.room.update({ where: { id: req.params.id }, data: body }));
});
