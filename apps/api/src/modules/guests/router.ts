import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../lib/db.js';
import { HttpError } from '../../lib/errors.js';
import { allowRoles } from '../../middleware/auth.js';

export const guestsRouter = Router();
guestsRouter.use(allowRoles('ADMIN','MANAGER','RECEPTIONIST'));
const guestInput = z.object({ firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80), phone: z.string().max(40).optional().nullable(), email: z.string().email().optional().nullable(), nationality: z.string().max(60).optional().nullable(), idType: z.enum(['NATIONAL_ID','PASSPORT','DRIVERS_LICENSE','OTHER']).optional().nullable(), idNumber: z.string().max(100).optional().nullable(), preferences: z.string().max(1000).optional().nullable(), notes: z.string().max(2000).optional().nullable() });
guestsRouter.get('/', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  const terms = q.split(/\s+/).filter(Boolean);
  const guests = await db.guest.findMany({ where: terms.length ? { AND: terms.map(term => ({ OR: [{ firstName: { contains: term, mode: 'insensitive' as const } }, { lastName: { contains: term, mode: 'insensitive' as const } }, { phone: { contains: term } }, { idNumber: { contains: term, mode: 'insensitive' as const } }] })) } : {}, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }], take: 50 });
  res.json(guests);
});
guestsRouter.post('/', allowRoles('ADMIN','MANAGER','RECEPTIONIST'), async (req, res) => res.status(201).json(await db.guest.create({ data: guestInput.parse(req.body) })));
guestsRouter.patch('/:id', allowRoles('ADMIN','MANAGER','RECEPTIONIST'), async (req, res) => res.json(await db.guest.update({ where: { id: String(req.params.id) }, data: guestInput.partial().parse(req.body) })));
guestsRouter.get('/:id', async (req, res) => {
  const guest = await db.guest.findUnique({ where: { id: String(req.params.id) }, include: { stays: { orderBy: { checkInAt: 'desc' }, include: { room: true, folio: { include: { items: true, payments: true } } } }, reservations: { orderBy: { arrivalDate: 'desc' } }, documents: { select: { id: true, documentType: true, sizeBytes: true, createdAt: true }, orderBy: { createdAt: 'desc' } } } });
  if (!guest) throw new HttpError(404, 'Guest not found');
  const completed = guest.stays.filter(s => s.status === 'CHECKED_OUT');
  const totalNights = completed.reduce((sum, s) => sum + (s.checkOutAt ? Math.max(0, Math.ceil((new Date(s.checkOutAt).getTime() - new Date(s.checkInAt).getTime()) / 86400000)) : 0), 0);
  const totalSpent = completed.reduce((sum, s) => sum + (s.folio?.payments.reduce((p, payment) => p + Number(payment.amount), 0) ?? 0), 0);
  const profile = { ...guest } as typeof guest & { insights?: { totalStays: number; totalNights: number; totalSpent: number; lastStayDate: Date | null } };
  if (req.user?.role === 'ADMIN' || req.user?.role === 'MANAGER') profile.insights = { totalStays: completed.length, totalNights, totalSpent, lastStayDate: completed[0]?.checkOutAt ?? null };
  res.json(profile);
});
