import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../lib/db.js';
import { HttpError } from '../../lib/errors.js';
import { logActivity } from '../../lib/audit.js';
import { allowRoles } from '../../middleware/auth.js';

export const billingRouter = Router();
billingRouter.use(allowRoles('ADMIN','MANAGER','RECEPTIONIST'));
const moneyCents = (value: number) => Math.round(value * 100);
function chargeAmount(type: 'ROOM_CHARGE' | 'EXTRA' | 'TAX' | 'DISCOUNT', quantity: number, unitPrice: number) {
  const amount = Math.round(quantity * unitPrice * 100) / 100;
  return type === 'DISCOUNT' ? -Math.abs(amount) : amount;
}
billingRouter.get('/folio/:id', async (req, res) => {
  const folio = await db.folio.findUnique({ where: { id: String(req.params.id) }, include: { items: { orderBy: { postedAt: 'asc' } }, payments: { orderBy: { receivedAt: 'asc' } }, stay: { include: { guest: true, room: true } } } });
  if (!folio) throw new HttpError(404, 'Folio not found');
  const charges = folio.items.reduce((n, item) => n + Number(item.amount), 0);
  const paid = folio.payments.reduce((n, p) => n + Number(p.amount), 0);
  res.json({ ...folio, summary: { charges, paid, balance: charges - paid } });
});
billingRouter.post('/folio/:id/items', allowRoles('ADMIN','MANAGER','RECEPTIONIST'), async (req, res) => {
  const d = z.object({ description: z.string().trim().min(1).max(200), quantity: z.number().positive().default(1), unitPrice: z.number(), type: z.enum(['EXTRA','TAX','DISCOUNT']).default('EXTRA') }).parse(req.body);
  if (d.type !== 'DISCOUNT' && d.unitPrice < 0) throw new HttpError(400, 'Use a discount item for a negative adjustment');
  const item = await db.$transaction(async tx => {
    const folio = await tx.folio.findUnique({ where: { id: String(req.params.id) } });
    if (!folio || folio.status !== 'OPEN') throw new HttpError(409, 'Folio is not open');
    return tx.folioItem.create({ data: { folioId: folio.id, ...d, amount: chargeAmount(d.type, d.quantity, d.unitPrice), postedById: req.user?.id } });
  }, { isolationLevel: 'Serializable' });
  await logActivity(req, 'folio.item_added', 'Folio', String(req.params.id), { description: d.description, amount: item.amount });
  res.status(201).json(item);
});
billingRouter.patch('/folio/:id/items/:itemId', async (req, res) => {
  const d = z.object({ description: z.string().trim().min(1).max(200).optional(), quantity: z.number().positive().optional(), unitPrice: z.number().optional(), type: z.enum(['ROOM_CHARGE','EXTRA','TAX','DISCOUNT']).optional() }).parse(req.body);
  if (!Object.keys(d).length) throw new HttpError(400, 'Provide at least one field to update');
  const result = await db.$transaction(async tx => {
    const folio = await tx.folio.findUnique({ where: { id: String(req.params.id) }, include: { items: true } });
    const item = folio?.items.find(x => x.id === req.params.itemId as string);
    if (!folio || folio.status !== 'OPEN') throw new HttpError(409, 'Folio is not open');
    if (!item) throw new HttpError(404, 'Folio item not found');
    const type = d.type ?? item.type;
    const quantity = d.quantity ?? Number(item.quantity);
    const unitPrice = d.unitPrice ?? Number(item.unitPrice);
    if (!['DISCOUNT','ROOM_CHARGE'].includes(type) && unitPrice < 0) throw new HttpError(400, 'Use a discount item for a negative adjustment');
    return tx.folioItem.update({ where: { id: item.id }, data: { ...d, amount: chargeAmount(type, quantity, unitPrice) } });
  }, { isolationLevel: 'Serializable' });
  await logActivity(req, 'folio.item_updated', 'Folio', String(req.params.id), { itemId: result.id, fields: Object.keys(d) });
  res.json(result);
});
billingRouter.delete('/folio/:id/items/:itemId', async (req, res) => {
  const result = await db.$transaction(async tx => {
    const folio = await tx.folio.findUnique({ where: { id: String(req.params.id) } });
    if (!folio || folio.status !== 'OPEN') throw new HttpError(409, 'Folio is not open');
    const item = await tx.folioItem.findFirst({ where: { id: req.params.itemId as string, folioId: folio.id } });
    if (!item) throw new HttpError(404, 'Folio item not found');
    await tx.folioItem.delete({ where: { id: item.id } });
    return item;
  }, { isolationLevel: 'Serializable' });
  await logActivity(req, 'folio.item_removed', 'Folio', String(req.params.id), { itemId: result.id, description: result.description, amount: result.amount });
  res.json({ removed: true });
});
billingRouter.post('/folio/:id/payments', allowRoles('ADMIN','MANAGER','RECEPTIONIST'), async (req, res) => {
  const d = z.object({ method: z.enum(['CASH','MOBILE_MONEY','CARD','BANK_TRANSFER']), amount: z.number().positive().refine(amount => Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-8, 'Enter an amount with no more than two decimal places'), reference: z.string().max(100).optional(), note: z.string().max(500).optional() }).parse(req.body);
  const payment = await db.$transaction(async tx => {
    const folio = await tx.folio.findUnique({ where: { id: String(req.params.id) }, include: { items: true, payments: true } });
    if (!folio) throw new HttpError(404, 'Folio not found');
    if (folio.status !== 'OPEN') throw new HttpError(409, 'Folio is closed');
    const charges = folio.items.reduce((n, item) => n + moneyCents(Number(item.amount)), 0);
    const paid = folio.payments.reduce((n, item) => n + moneyCents(Number(item.amount)), 0);
    if (moneyCents(d.amount) > charges - paid) throw new HttpError(409, 'Payment exceeds the outstanding balance');
    return tx.payment.create({ data: { folioId: folio.id, ...d, receivedById: req.user?.id } });
  }, { isolationLevel: 'Serializable' });
  await logActivity(req, 'folio.payment_recorded', 'Folio', String(req.params.id), { method: d.method, amount: d.amount });
  res.status(201).json(payment);
});
billingRouter.get('/folio/:id/invoice', async (req, res) => {
  const folio = await db.folio.findUnique({ where: { id: String(req.params.id) }, include: { items: true, payments: true, stay: { include: { guest: true, room: true } } } });
  if (!folio) throw new HttpError(404, 'Folio not found');
  const total = folio.items.reduce((n, x) => n + Number(x.amount), 0);
  const paid = folio.payments.reduce((n, x) => n + Number(x.amount), 0);
  res.json({ hotel: process.env.HOTEL_NAME ?? 'Hotel', folioNumber: folio.folioNumber, guest: folio.stay.guest, room: folio.stay.room, checkIn: folio.stay.checkInAt, checkOut: folio.stay.checkOutAt, items: folio.items, payments: folio.payments, total, paid, balance: total - paid });
});
