import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../lib/db.js';
import { HttpError } from '../../lib/errors.js';
import { logActivity } from '../../lib/audit.js';
import { allowRoles } from '../../middleware/auth.js';

export const housekeepingRouter = Router();
housekeepingRouter.get('/staff', async (_req, res) => res.json(await db.user.findMany({ where: { role: 'HOUSEKEEPING', active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } })));
housekeepingRouter.get('/tasks', async (_req, res) => res.json(await db.housekeepingTask.findMany({ where: { status: { not: 'DONE' } }, include: { room: true, assignedTo: { select: { id: true, name: true } } }, orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }] })));
housekeepingRouter.post('/tasks', allowRoles('ADMIN','MANAGER','RECEPTIONIST','HOUSEKEEPING'), async (req, res) => {
  const d = z.object({ roomId: z.string(), title: z.string().min(1).max(160), type: z.enum(['CLEANING','INSPECTION','MAINTENANCE','SPECIAL_REQUEST']).default('CLEANING'), notes: z.string().max(1000).optional(), assignedToId: z.string().optional(), dueAt: z.coerce.date().optional() }).parse(req.body);
  const task = await db.housekeepingTask.create({ data: { ...d, createdById: req.user?.id } });
  await logActivity(req, 'housekeeping.task_created', 'HousekeepingTask', task.id, { roomId: task.roomId, type: task.type });
  res.status(201).json(task);
});
housekeepingRouter.patch('/tasks/:id', allowRoles('ADMIN','MANAGER','RECEPTIONIST','HOUSEKEEPING'), async (req, res) => {
  const d = z.object({ status: z.enum(['OPEN','IN_PROGRESS','DONE']).optional(), assignedToId: z.string().nullable().optional(), notes: z.string().max(1000).optional() }).parse(req.body);
  const task = await db.housekeepingTask.findUnique({ where: { id: req.params.id } });
  if (!task) throw new HttpError(404, 'Task not found');
  const updated = await db.$transaction(async tx => {
    const next = await tx.housekeepingTask.update({ where: { id: task.id }, data: { ...d, completedAt: d.status === 'DONE' ? new Date() : d.status ? null : undefined } });
    if (d.status === 'DONE' && ['CLEANING','INSPECTION'].includes(task.type)) {
      const status = task.type === 'CLEANING' ? 'CLEAN' : 'INSPECTED';
      await tx.room.update({ where: { id: task.roomId }, data: { status } });
      if (task.type === 'CLEANING') await tx.housekeepingTask.create({ data: { roomId: task.roomId, type: 'INSPECTION', title: `Inspect room after cleaning`, createdById: req.user?.id } });
    }
    return next;
  });
  await logActivity(req, 'housekeeping.task_updated', 'HousekeepingTask', task.id, { status: updated.status });
  res.json(updated);
});
housekeepingRouter.post('/rooms/:roomId/inspect', allowRoles('ADMIN','MANAGER','RECEPTIONIST','HOUSEKEEPING'), async (req, res) => {
  const room = await db.room.findUnique({ where: { id: req.params.roomId } });
  if (!room) throw new HttpError(404, 'Room not found');
  if (room.status !== 'CLEAN') throw new HttpError(409, 'Only clean rooms can be inspected');
  const result = await db.$transaction([db.room.update({ where: { id: room.id }, data: { status: 'INSPECTED' } }), db.housekeepingTask.create({ data: { roomId: room.id, type: 'INSPECTION', title: `Inspection passed: room ${room.number}`, status: 'DONE', completedAt: new Date(), createdById: req.user?.id } })]);
  res.json(result[0]);
});
