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
  const rooms = await db.room.findMany({ ...query, include: { stays: { where: { status: 'IN_HOUSE' }, include: { guest: true } }, _count: { select: { stays: true } } } });
  res.json(rooms.map(({ _count, ...room }) => ({ ...room, stayCount: _count.stays })));
});
roomsRouter.patch('/:id/status', allowRoles('ADMIN', 'MANAGER', 'RECEPTIONIST'), async (req, res) => {
  const { status, notes } = z.object({ status: z.nativeEnum(RoomStatus), notes: z.string().max(500).optional() }).parse(req.body);
  const room = await db.room.findUnique({ where: { id: String(req.params.id) } });
  if (!room) throw new HttpError(404, 'Room not found');
  if (status === 'AVAILABLE' && await db.stay.findFirst({ where: { roomId: room.id, status: 'IN_HOUSE' } })) throw new HttpError(409, 'An occupied room cannot be marked available');
  const updated = await db.room.update({ where: { id: room.id }, data: { status, ...(notes === undefined ? {} : { notes }) } });
  await logActivity(req, 'room.status_updated', 'Room', room.id, { from: room.status, to: status });
  res.json(updated);
});
roomsRouter.patch('/:id', allowRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const body = z.object({ number: z.string().min(1).max(12).optional(), type: z.string().min(1).max(60).optional(), floor: z.number().int().optional(), capacity: z.number().int().min(1).max(12).optional(), baseRate: z.number().nonnegative().optional(), notes: z.string().max(1000).nullable().optional() }).parse(req.body);
  const room = await db.room.findUnique({ where: { id: String(req.params.id) } });
  if (!room || !room.active) throw new HttpError(404, 'Room not found');
  const nextType = body.type?.trim() ?? room.type;
  const typeChanged = nextType !== room.type;
  if (typeChanged && await db.stay.findFirst({ where: { roomId: room.id, status: 'IN_HOUSE' } })) {
    throw new HttpError(409, 'Check the guest out or move them before changing this room type');
  }
  const patchData = { ...body, ...(body.type === undefined ? {} : { type: nextType }) };

  // Room rates are shared by type. Changing a type's price updates every room
  // in that type; changing a room's type adopts the destination type's rate.
  let nextRate = body.baseRate;
  if (typeChanged && nextRate === undefined) {
    const sibling = await db.room.findFirst({ where: { active: true, type: nextType, id: { not: room.id } }, select: { baseRate: true } });
    nextRate = sibling ? Number(sibling.baseRate) : Number(room.baseRate);
  }
  const data = { ...patchData, ...(nextRate === undefined ? {} : { baseRate: nextRate }) };
  const updated = await db.$transaction(async tx => {
    if (nextRate !== undefined) {
      await tx.room.updateMany({ where: { active: true, type: nextType }, data: { baseRate: nextRate } });
    }
    return tx.room.update({ where: { id: room.id }, data });
  });
  await logActivity(req, 'room.details_updated', 'Room', room.id, { changed: Object.keys(body), type: nextType, baseRate: nextRate });
  res.json(updated);
});
