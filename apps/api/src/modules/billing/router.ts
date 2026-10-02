import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../lib/db.js';
import { HttpError } from '../../lib/errors.js';
import { logActivity } from '../../lib/audit.js';
import { allowRoles } from '../../middleware/auth.js';

export const billingRouter = Router();
billingRouter.use(allowRoles('ADMIN','MANAGER','RECEPTIONIST'));
billingRouter.get('/folio/:id', async (req, res) => {
  const folio = await db.folio.findUnique({ where: { id: req.params.id }, include: { items: { orderBy: { postedAt: 'asc' } }, payments: { orderBy: { receivedAt: 'asc' } }, stay: { include: { guest: true, room: true } } } });
  if (!folio) throw new HttpError(404, 'Folio not found');
  const charges = folio.items.reduce((n, item) => n + Number(item.amount), 0);
  const paid = folio.payments.reduce((n, p) => n + Number(p.amount), 0);
  res.json({ ...folio, summary: { charges, paid, balance: charges - paid } });
});
billingRouter.post('/folio/:id/items', allowRoles('ADMIN','MANAGER','RECEPTIONIST'), async (req, res) => {
  const d = z.object({ description: z.string().trim().min(1).max(200), quantity: z.number().positive().default(1), unitPrice: z.number(), type: z.enum(['EXTRA','TAX','DISCOUNT']).default('EXTRA') }).parse(req.body);
  const folio = await db.folio.findUnique({ where: { id: req.params.id } });
  if (!folio || folio.status !== 'OPEN') throw new HttpError(409, 'Folio is not open');
  const item = await db.folioItem.create({ data: { folioId: folio.id, ...d, amount: d.quantity * d.unitPrice, postedById: req.user?.id } });
  await logActivity(req, 'folio.item_added', 'Folio', folio.id, { description: d.description, amount: item.amount });
  res.status(201).json(item);
});
billingRouter.post('/folio/:id/payments', allowRoles('ADMIN','MANAGER','RECEPTIONIST'), async (req, res) => {
  const d = z.object({ method: z.enum(['CASH','MOBILE_MONEY','CARD','BANK_TRANSFER']), amount: z.number().positive(), reference: z.string().max(100).optional(), note: z.string().max(500).optional() }).parse(req.body);
  const folio = await db.folio.findUnique({ where: { id: req.params.id } });
  if (!folio) throw new HttpError(404, 'Folio not found');
  const payment = await db.payment.create({ data: { folioId: folio.id, ...d, receivedById: req.user?.id } });
  await logActivity(req, 'folio.payment_recorded', 'Folio', folio.id, { method: d.method, amount: d.amount });
  res.status(201).json(payment);
});
billingRouter.get('/folio/:id/invoice', async (req, res) => {
  const folio = await db.folio.findUnique({ where: { id: req.params.id }, include: { items: true, payments: true, stay: { include: { guest: true, room: true } } } });
  if (!folio) throw new HttpError(404, 'Folio not found');
  const total = folio.items.reduce((n, x) => n + Number(x.amount), 0);
  const paid = folio.payments.reduce((n, x) => n + Number(x.amount), 0);
  res.json({ hotel: process.env.HOTEL_NAME ?? 'Hotel', folioNumber: folio.folioNumber, guest: folio.stay.guest, room: folio.stay.room, checkIn: folio.stay.checkInAt, checkOut: folio.stay.checkOutAt, items: folio.items, payments: folio.payments, total, paid, balance: total - paid });
});
