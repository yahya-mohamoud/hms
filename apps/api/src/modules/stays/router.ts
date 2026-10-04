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
  const stay = await db.stay.findUnique({ where: { id: String(req.params.id) }, include: { guest: true, room: true, folio: { include: { ...folioInclude, stay: true } }, roomMoves: true } });
  if (!stay) throw new HttpError(404, 'Stay not found');
  res.json(stay);
});

staysRouter.post('/check-in', allowRoles('ADMIN','MANAGER','RECEPTIONIST'), async (req, res) => {
  const d = z.object({ reservationId: z.string().optional(), guestId: z.string().optional(), guest: z.object({ firstName: z.string().min(1), lastName: z.string().min(1), phone: z.string().optional(), nationality: z.string().optional() }).optional(), roomId: z.string(), expectedCheckOut: z.coerce.date(), nightlyRate: z.number().nonnegative().refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8, 'Use no more than two decimal places').optional(), adults: z.number().int().min(1).default(1), children: z.number().int().min(0).default(0), idType: z.enum(['NATIONAL_ID','PASSPORT','DRIVERS_LICENSE','OTHER']).optional(), idNumber: z.string().max(100).optional(), notes: z.string().max(2000).optional() }).refine(x => !!x.reservationId || !!x.guestId || !!x.guest, 'Choose a reservation or guest').parse(req.body);
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
    if (d.expectedCheckOut <= today) throw new HttpError(400, 'Expected departure must be after today');
    const reserved = await tx.reservation.findFirst({ where: { roomId: room.id, id: reservation?.id ? { not: reservation.id } : undefined, status: { notIn: ['CANCELLED','NO_SHOW'] }, arrivalDate: { lt: d.expectedCheckOut }, departureDate: { gt: today } } });
    if (reserved) throw new HttpError(409, 'Room has another reservation during this stay');
    const nights = Math.max(1, Math.ceil((d.expectedCheckOut.getTime() - today.getTime()) / 86400000));
    const nightlyRate = d.nightlyRate ?? Number(reservation?.nightlyRate ?? room.baseRate);
    if (reservation && Math.round(Number(reservation.depositAmount) * 100) > Math.round(nightlyRate * 100) * nights) throw new HttpError(409, 'Reservation deposit exceeds the room charge for this stay; adjust the room rate before check-in');
    const stay = await tx.stay.create({ data: { reservationId: reservation?.id, guestId: guest.id, roomId: room.id, expectedCheckOut: d.expectedCheckOut, nightlyRate, adults: d.adults, children: d.children, notes: d.notes } });
    const folio = await tx.folio.create({ data: { folioNumber: `F-${Date.now().toString(36).toUpperCase()}`, stayId: stay.id } });
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
  const stayId = String(req.params.id);
  const stay = await db.$transaction(async tx => {
    const current = await tx.stay.findUnique({ where: { id: stayId }, include: { room: true } });
    if (!current || current.status !== 'IN_HOUSE') throw new HttpError(404, 'Active stay not found');
    const room = await tx.room.findUnique({ where: { id: roomId } });
    if (!room || !room.active || ['DIRTY','OUT_OF_ORDER'].includes(room.status)) throw new HttpError(409, 'Destination room is not ready');
    if (await tx.stay.findFirst({ where: { roomId, status: 'IN_HOUSE' } })) throw new HttpError(409, 'Destination room is occupied');
    const today = new Date(new Date().toISOString().slice(0,10));
    const reserved = await tx.reservation.findFirst({ where: { roomId, id: current.reservationId ? { not: current.reservationId } : undefined, status: { notIn: ['CANCELLED','NO_SHOW'] }, arrivalDate: { lt: current.expectedCheckOut }, departureDate: { gt: today } } });
    if (reserved) throw new HttpError(409, 'Destination room has a reservation before this stay ends');
    const rateDifference = Math.round((Number(room.baseRate) - Number(current.nightlyRate)) * 100) / 100;
    const nightsRemaining = Math.max(0, Math.ceil((new Date(current.expectedCheckOut).setUTCHours(0,0,0,0) - new Date(`${today.toISOString().slice(0,10)}T00:00:00.000Z`).getTime()) / 86400000));
    if (rateDifference > 0 && nightsRemaining > 0) {
      const folio = await tx.folio.findUnique({ where: { stayId: current.id } });
      if (!folio || folio.status !== 'OPEN') throw new HttpError(409, 'The stay folio is not open for a room-rate adjustment');
      const adjustment = Math.round(rateDifference * nightsRemaining * 100) / 100;
      await tx.folioItem.create({ data: { folioId: folio.id, type: 'ROOM_CHARGE', description: `Room rate adjustment after transfer (${nightsRemaining} remaining night${nightsRemaining === 1 ? '' : 's'})`, quantity: nightsRemaining, unitPrice: rateDifference, amount: adjustment, postedById: req.user?.id } });
    }
    await tx.roomMove.create({ data: { stayId: current.id, fromRoomId: current.roomId, toRoomId: roomId, reason } });
    await tx.room.update({ where: { id: current.roomId }, data: { status: 'DIRTY' } });
    await tx.room.update({ where: { id: roomId }, data: { status: 'OCCUPIED' } });
    if (current.reservationId) await tx.reservation.update({ where: { id: current.reservationId }, data: { roomId } });
    return tx.stay.update({ where: { id: current.id }, data: { roomId, nightlyRate: rateDifference > 0 ? room.baseRate : current.nightlyRate }, include: { room: true, guest: true } });
  }, { isolationLevel: 'Serializable' });
  await logActivity(req, 'stay.room_moved', 'Stay', stay.id, { roomId });
  res.json(stay);
});
staysRouter.post('/:id/check-out', allowRoles('ADMIN','MANAGER','RECEPTIONIST'), async (req, res) => {
  const { notes } = z.object({ notes: z.string().max(1000).optional() }).parse(req.body ?? {});
  const stay = await db.$transaction(async tx => {
    const current = await tx.stay.findUnique({ where: { id: String(req.params.id) }, include: { reservation: true, room: true, folio: { include: { items: true, payments: true } } } });
    if (!current || current.status !== 'IN_HOUSE') throw new HttpError(409, 'Stay is already checked out');
    if (!current.folio) throw new HttpError(409, 'Stay has no folio');
    const chargesCents = current.folio.items.reduce((n, item) => n + Math.round(Number(item.amount) * 100), 0);
    const paidCents = current.folio.payments.reduce((n, payment) => n + Math.round(Number(payment.amount) * 100), 0);
    if (chargesCents !== paidCents) throw new HttpError(409, `Settle the folio to an exact zero balance before checkout. Current balance: ${(chargesCents - paidCents) / 100}`);
    const updated = await tx.stay.update({ where: { id: current.id }, data: { status: 'CHECKED_OUT', checkOutAt: new Date(), notes: notes ? `${current.notes ?? ''}\n${notes}`.trim() : current.notes } });
    await tx.room.update({ where: { id: current.roomId }, data: { status: 'DIRTY' } });
    if (current.reservationId) await tx.reservation.update({ where: { id: current.reservationId }, data: { status: 'CHECKED_OUT' } });
    await tx.folio.update({ where: { stayId: current.id }, data: { status: 'CLOSED', closedAt: new Date() } });
    return updated;
  }, { isolationLevel: 'Serializable' });
  await logActivity(req, 'stay.checked_out', 'Stay', stay.id);
  res.json(stay);
});
