import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../lib/db.js';
import { HttpError } from '../../lib/errors.js';
import { logActivity } from '../../lib/audit.js';
import { allowRoles } from '../../middleware/auth.js';

export const staysRouter = Router();
const folioInclude = { items: { orderBy: { postedAt: 'asc' as const } }, payments: { orderBy: { receivedAt: 'asc' as const } } };

staysRouter.get('/in-house', allowRoles('ADMIN','MANAGER','RECEPTIONIST'), async (_req, res) => res.json(await db.stay.findMany({ where: { status: 'IN_HOUSE' }, include: { guest: true, room: true, folio: { include: folioInclude } }, orderBy: { checkInAt: 'asc' } })));
staysRouter.get('/:id', allowRoles('ADMIN','MANAGER','RECEPTIONIST'), async (req, res) => {
  const stay = await db.stay.findUnique({ where: { id: req.params.id }, include: { guest: true, room: true, folio: { include: { ...folioInclude, stay: true } }, roomMoves: true } });
  if (!stay) throw new HttpError(404, 'Stay not found');
  res.json(stay);
});

staysRouter.post('/check-in', allowRoles('ADMIN','MANAGER','RECEPTIONIST'), async (req, res) => {
  const d = z.object({ reservationId: z.string().optional(), guestId: z.string().optional(), guest: z.object({ firstName: z.string().min(1), lastName: z.string().min(1), phone: z.string().optional(), nationality: z.string().optional() }).optional(), roomId: z.string(), expectedCheckOut: z.coerce.date(), nightlyRate: z.number().nonnegative().optional(), adults: z.number().int().min(1).default(1), children: z.number().int().min(0).default(0), idType: z.enum(['NATIONAL_ID','PASSPORT','DRIVERS_LICENSE','OTHER']).optional(), idNumber: z.string().max(100).optional(), notes: z.string().max(2000).optional() }).refine(x => !!x.reservationId || !!x.guestId || !!x.guest, 'Choose a reservation or guest').parse(req.body);
  const result = await db.$transaction(async tx => {
    const reservation = d.reservationId ? await tx.reservation.findUnique({ where: { id: d.reservationId } }) : null;
    if (d.reservationId && !reservation) throw new HttpError(404, 'Reservation not found');
    if (reservation && !['CONFIRMED','PENDING'].includes(reservation.status)) throw new HttpError(409, 'Reservation is not ready for check-in');
    const guestId = reservation?.guestId ?? d.guestId;
    const guest = guestId ? await tx.guest.findUnique({ where: { id: guestId } }) : await tx.guest.create({ data: d.guest! });
    if (!guest) throw new HttpError(404, 'Guest not found');
    const room = await tx.room.findUnique({ where: { id: d.roomId } });
    if (!room || !room.active) throw new HttpError(404, 'Room not found');
    if (room.status === 'OUT_OF_ORDER' || room.status === 'DIRTY') throw new HttpError(409, 'Room must be clean and in service before check-in');
    const occupied = await tx.stay.findFirst({ where: { roomId: room.id, status: 'IN_HOUSE' } });
    if (occupied) throw new HttpError(409, 'Room is occupied');
    const today = new Date(new Date().toISOString().slice(0,10));
    const reserved = await tx.reservation.findFirst({ where: { roomId: room.id, id: reservation?.id ? { not: reservation.id } : undefined, status: { notIn: ['CANCELLED','NO_SHOW'] }, arrivalDate: { lt: d.expectedCheckOut }, departureDate: { gt: today } } });
    if (reserved) throw new HttpError(409, 'Room has another reservation during this stay');
    const stay = await tx.stay.create({ data: { reservationId: reservation?.id, guestId: guest.id, roomId: room.id, expectedCheckOut: d.expectedCheckOut, nightlyRate: d.nightlyRate ?? reservation?.nightlyRate ?? room.baseRate, adults: d.adults, children: d.children, notes: d.notes } });
    const folio = await tx.folio.create({ data: { folioNumber: `F-${Date.now().toString(36).toUpperCase()}`, stayId: stay.id } });
    const nights = Math.max(1, Math.ceil((d.expectedCheckOut.getTime() - Date.now()) / 86400000));
    await tx.folioItem.create({ data: { folioId: folio.id, type: 'ROOM_CHARGE', description: `Room ${room.number} × ${nights} night${nights === 1 ? '' : 's'}`, quantity: nights, unitPrice: stay.nightlyRate, amount: Number(stay.nightlyRate) * nights, postedById: req.user?.id } });
    if (reservation && Number(reservation.depositAmount) > 0) await tx.payment.create({ data: { folioId: folio.id, method: reservation.depositMethod, amount: reservation.depositAmount, note: 'Reservation deposit', receivedById: req.user?.id } });
    await tx.room.update({ where: { id: room.id }, data: { status: 'OCCUPIED' } });
    if (reservation) await tx.reservation.update({ where: { id: reservation.id }, data: { status: 'CHECKED_IN', roomId: room.id } });
    if (d.idType || d.idNumber) await tx.guest.update({ where: { id: guest.id }, data: { idType: d.idType, idNumber: d.idNumber } });
    return { stay, folio, guest, room };
  }, { isolationLevel: 'Serializable' });
  await logActivity(req, 'stay.checked_in', 'Stay', result.stay.id, { roomId: result.room.id });
  res.status(201).json(result);
});

staysRouter.post('/:id/move-room', allowRoles('ADMIN','MANAGER','RECEPTIONIST'), async (req, res) => {
  const { roomId, reason } = z.object({ roomId: z.string(), reason: z.string().max(500).optional() }).parse(req.body);
  const stay = await db.$transaction(async tx => {
    const current = await tx.stay.findUnique({ where: { id: req.params.id } });
    if (!current || current.status !== 'IN_HOUSE') throw new HttpError(404, 'Active stay not found');
    const room = await tx.room.findUnique({ where: { id: roomId } });
    if (!room || ['DIRTY','OUT_OF_ORDER'].includes(room.status)) throw new HttpError(409, 'Destination room is not ready');
    if (await tx.stay.findFirst({ where: { roomId, status: 'IN_HOUSE' } })) throw new HttpError(409, 'Destination room is occupied');
    const today = new Date(new Date().toISOString().slice(0,10));
    const reserved = await tx.reservation.findFirst({ where: { roomId, id: current.reservationId ? { not: current.reservationId } : undefined, status: { notIn: ['CANCELLED','NO_SHOW'] }, arrivalDate: { lt: current.expectedCheckOut }, departureDate: { gt: today } } });
    if (reserved) throw new HttpError(409, 'Destination room has a reservation before this stay ends');
    await tx.roomMove.create({ data: { stayId: current.id, fromRoomId: current.roomId, toRoomId: roomId, reason } });
    await tx.room.update({ where: { id: current.roomId }, data: { status: 'DIRTY' } });
    await tx.housekeepingTask.create({ data: { roomId: current.roomId, type: 'CLEANING', title: `Clean room ${current.room.number} after room move`, createdById: req.user?.id } });
    await tx.room.update({ where: { id: roomId }, data: { status: 'OCCUPIED' } });
    if (current.reservationId) await tx.reservation.update({ where: { id: current.reservationId }, data: { roomId } });
    return tx.stay.update({ where: { id: current.id }, data: { roomId }, include: { room: true, guest: true } });
  }, { isolationLevel: 'Serializable' });
  await logActivity(req, 'stay.room_moved', 'Stay', stay.id, { roomId });
  res.json(stay);
});
staysRouter.post('/:id/check-out', allowRoles('ADMIN','MANAGER','RECEPTIONIST'), async (req, res) => {
  const { notes } = z.object({ notes: z.string().max(1000).optional() }).parse(req.body ?? {});
  const stay = await db.$transaction(async tx => {
    const current = await tx.stay.findUnique({ where: { id: req.params.id }, include: { reservation: true, room: true } });
    if (!current || current.status !== 'IN_HOUSE') throw new HttpError(409, 'Stay is already checked out');
    const updated = await tx.stay.update({ where: { id: current.id }, data: { status: 'CHECKED_OUT', checkOutAt: new Date(), notes: notes ? `${current.notes ?? ''}\n${notes}`.trim() : current.notes } });
    await tx.room.update({ where: { id: current.roomId }, data: { status: 'DIRTY' } });
    await tx.housekeepingTask.create({ data: { roomId: current.roomId, type: 'CLEANING', title: `Turnover after checkout: room ${current.room.number}`, createdById: req.user?.id } });
    if (current.reservationId) await tx.reservation.update({ where: { id: current.reservationId }, data: { status: 'CHECKED_OUT' } });
    await tx.folio.update({ where: { stayId: current.id }, data: { status: 'CLOSED', closedAt: new Date() } });
    return updated;
  });
  await logActivity(req, 'stay.checked_out', 'Stay', stay.id);
  res.json(stay);
});
