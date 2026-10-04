import { Router } from 'express';
import { BookingSource, PaymentMethod, ReservationStatus } from '@prisma/client';
import { z } from 'zod';
import { db } from '../../lib/db.js';
import { HttpError } from '../../lib/errors.js';
import { logActivity } from '../../lib/audit.js';
import { allowRoles } from '../../middleware/auth.js';

export const reservationsRouter = Router();
reservationsRouter.use(allowRoles('ADMIN','MANAGER','RECEPTIONIST'));
const cents = (amount: number) => Math.round(amount * 100);
const moneySchema = z.number().nonnegative().refine(amount => Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-8, 'Use no more than two decimal places');
const stayNights = (arrival: Date, departure: Date) => Math.max(1, Math.round((Date.parse(`${departure.toISOString().slice(0,10)}T00:00:00Z`) - Date.parse(`${arrival.toISOString().slice(0,10)}T00:00:00Z`)) / 86400000));
const input = z.object({ guestId: z.string().optional(), guest: z.object({ firstName: z.string().min(1), lastName: z.string().min(1), phone: z.string().optional(), nationality: z.string().optional() }).optional(), source: z.nativeEnum(BookingSource), groupCode: z.string().max(40).optional(), groupName: z.string().max(100).optional(), arrivalDate: z.coerce.date(), departureDate: z.coerce.date(), adults: z.number().int().min(1).default(1), children: z.number().int().min(0).default(0), roomType: z.string().optional(), roomId: z.string().optional(), nightlyRate: moneySchema, depositAmount: moneySchema.default(0), depositMethod: z.nativeEnum(PaymentMethod).default('CASH'), notes: z.string().max(2000).optional() }).refine(d => d.arrivalDate < d.departureDate, 'Departure must be after arrival').refine(d => cents(d.depositAmount) <= cents(d.nightlyRate) * stayNights(d.arrivalDate,d.departureDate), 'Deposit cannot exceed the total room charge').refine(d => !!d.guestId || !!d.guest, 'Choose or add a guest');
const code = () => `H${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2,5).toUpperCase()}`;

reservationsRouter.get('/', async (req, res) => {
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(new Date().setHours(0,0,0,0));
  const to = req.query.to ? new Date(String(req.query.to)) : new Date(from.getTime() + 31 * 86400000);
  const items = await db.reservation.findMany({ where: { arrivalDate: { lt: to }, departureDate: { gt: from } }, include: { guest: true, room: true, stay: true }, orderBy: { arrivalDate: 'asc' } });
  res.json(items);
});
reservationsRouter.post('/', allowRoles('ADMIN','MANAGER','RECEPTIONIST'), async (req, res) => {
  const d = input.parse(req.body);
  const reservation = await db.$transaction(async tx => {
    const guest = d.guestId ? await tx.guest.findUnique({ where: { id: d.guestId } }) : await tx.guest.create({ data: d.guest! });
    if (!guest) throw new HttpError(404, 'Guest not found');
    if (d.roomId) {
      const clash = await tx.reservation.findFirst({ where: { roomId: d.roomId, status: { notIn: ['CANCELLED','NO_SHOW'] }, arrivalDate: { lt: d.departureDate }, departureDate: { gt: d.arrivalDate } } });
      if (clash) throw new HttpError(409, 'Room is already reserved for those dates');
      const occupied = await tx.stay.findFirst({ where: { roomId: d.roomId, status: 'IN_HOUSE', expectedCheckOut: { gt: d.arrivalDate } } });
      if (occupied) throw new HttpError(409, 'Room is occupied during those dates');
    }
    return tx.reservation.create({ data: { confirmationCode: code(), guestId: guest.id, source: d.source, groupCode: d.groupCode, groupName: d.groupName, arrivalDate: d.arrivalDate, departureDate: d.departureDate, adults: d.adults, children: d.children, roomType: d.roomType, roomId: d.roomId, nightlyRate: d.nightlyRate, depositAmount: d.depositAmount, depositMethod: d.depositMethod, notes: d.notes, createdById: req.user?.id }, include: { guest: true, room: true } });
  }, { isolationLevel: 'Serializable' });
  await logActivity(req, 'reservation.created', 'Reservation', reservation.id, { source: reservation.source });
  res.status(201).json(reservation);
});
reservationsRouter.patch('/:id', allowRoles('ADMIN','MANAGER','RECEPTIONIST'), async (req, res) => {
  const d = z.object({ arrivalDate: z.coerce.date().optional(), departureDate: z.coerce.date().optional(), roomId: z.string().nullable().optional(), roomType: z.string().optional(), nightlyRate: moneySchema.optional(), depositAmount: moneySchema.optional(), depositMethod: z.nativeEnum(PaymentMethod).optional(), adults: z.number().int().min(1).optional(), children: z.number().int().min(0).optional(), notes: z.string().max(2000).optional(), status: z.nativeEnum(ReservationStatus).optional(), cancellationNote: z.string().max(1000).optional() }).parse(req.body);
  const old = await db.reservation.findUnique({ where: { id: String(req.params.id) } });
  if (!old) throw new HttpError(404, 'Reservation not found');
  if (!['CONFIRMED','PENDING'].includes(old.status)) throw new HttpError(409, 'Only pending or confirmed reservations can be edited');
  const arrivalDate = d.arrivalDate ?? old.arrivalDate, departureDate = d.departureDate ?? old.departureDate;
  if (arrivalDate >= departureDate) throw new HttpError(400, 'Departure must be after arrival');
  const nightlyRate = d.nightlyRate ?? Number(old.nightlyRate), depositAmount = d.depositAmount ?? Number(old.depositAmount);
  if (cents(depositAmount) > cents(nightlyRate) * stayNights(arrivalDate, departureDate)) throw new HttpError(400, 'Deposit cannot exceed the total room charge');
  const roomId = d.roomId === null ? null : d.roomId ?? old.roomId;
  if (roomId) {
    const clash = await db.reservation.findFirst({ where: { id: { not: old.id }, roomId, status: { notIn: ['CANCELLED','NO_SHOW'] }, arrivalDate: { lt: departureDate }, departureDate: { gt: arrivalDate } } });
    if (clash) throw new HttpError(409, 'Room is already reserved for those dates');
    const occupied = await db.stay.findFirst({ where: { roomId, status: 'IN_HOUSE', expectedCheckOut: { gt: arrivalDate } } });
    if (occupied) throw new HttpError(409, 'Room is occupied during those dates');
  }
  const updated = await db.reservation.update({ where: { id: old.id }, data: { ...d, arrivalDate, departureDate, roomId } });
  await logActivity(req, 'reservation.updated', 'Reservation', old.id, { changed: Object.keys(d) });
  res.json(updated);
});
reservationsRouter.post('/:id/cancel', allowRoles('ADMIN','MANAGER','RECEPTIONIST'), async (req, res) => {
  const { note } = z.object({ note: z.string().max(1000).optional() }).parse(req.body);
  const current = await db.reservation.findUnique({ where: { id: String(req.params.id) } });
  if (!current) throw new HttpError(404, 'Reservation not found');
  if (!['CONFIRMED','PENDING'].includes(current.status)) throw new HttpError(409, 'Only pending or confirmed reservations can be cancelled');
  const item = await db.reservation.update({ where: { id: String(req.params.id) }, data: { status: 'CANCELLED', cancellationNote: note ?? '' } });
  await logActivity(req, 'reservation.cancelled', 'Reservation', item.id);
  res.json(item);
});
