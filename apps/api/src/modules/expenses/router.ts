import { ExpenseCategory, PaymentMethod } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../lib/db.js';
import { HttpError } from '../../lib/errors.js';
import { logActivity } from '../../lib/audit.js';
import { allowRoles } from '../../middleware/auth.js';

export const expensesRouter = Router();
const money = z.number().positive().refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8, 'Use no more than two decimal places');
const expenseFields = {
  category: z.nativeEnum(ExpenseCategory),
  description: z.string().trim().min(2).max(300),
  payee: z.string().trim().max(120).nullable().optional(),
  amount: money,
  paymentMethod: z.nativeEnum(PaymentMethod),
  reference: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  expenseDate: z.string().date(),
};

expensesRouter.get('/', allowRoles('ADMIN', 'MANAGER', 'RECEPTIONIST'), async (req, res) => {
  const query = z.object({ from: z.string().date().optional(), to: z.string().date().optional() }).parse(req.query);
  if ((query.from && !query.to) || (!query.from && query.to)) throw new HttpError(400, 'Provide both from and to dates');
  if (query.from && query.to && query.from > query.to) throw new HttpError(400, 'Start date must be before end date');
  const where = {
    ...(query.from && query.to ? { expenseDate: { gte: new Date(`${query.from}T00:00:00.000Z`), lt: new Date(new Date(`${query.to}T00:00:00.000Z`).getTime() + 86400000) } } : {}),
  };
  res.json(await db.expense.findMany({ where, include: { recordedBy: { select: { id: true, name: true } } }, orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }] }));
});

expensesRouter.post('/', allowRoles('ADMIN', 'MANAGER', 'RECEPTIONIST'), async (req, res) => {
  const input = z.object(expenseFields).parse(req.body);
  const expense = await db.expense.create({ data: { ...input, expenseDate: new Date(`${input.expenseDate}T00:00:00.000Z`), recordedById: req.user?.id } });
  await logActivity(req, 'expense.recorded', 'Expense', expense.id, { amount: Number(expense.amount), category: expense.category, expenseDate: input.expenseDate });
  res.status(201).json(expense);
});

expensesRouter.patch('/:id', allowRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const input = z.object(expenseFields).partial().refine(value => Object.keys(value).length > 0, 'Provide at least one field to update').parse(req.body);
  const current = await db.expense.findUnique({ where: { id: String(req.params.id) } });
  if (!current) throw new HttpError(404, 'Expense not found');
  if (current.voidedAt) throw new HttpError(409, 'A voided expense cannot be edited');
  const { expenseDate, ...rest } = input;
  const expense = await db.expense.update({ where: { id: current.id }, data: { ...rest, ...(expenseDate ? { expenseDate: new Date(`${expenseDate}T00:00:00.000Z`) } : {}) } });
  await logActivity(req, 'expense.updated', 'Expense', expense.id, { changed: Object.keys(input) });
  res.json(expense);
});

expensesRouter.post('/:id/void', allowRoles('ADMIN', 'MANAGER'), async (req, res) => {
  const { reason } = z.object({ reason: z.string().trim().min(3).max(500) }).parse(req.body);
  const current = await db.expense.findUnique({ where: { id: String(req.params.id) } });
  if (!current) throw new HttpError(404, 'Expense not found');
  if (current.voidedAt) throw new HttpError(409, 'Expense has already been voided');
  const expense = await db.expense.update({ where: { id: current.id }, data: { voidedAt: new Date(), voidReason: reason } });
  await logActivity(req, 'expense.voided', 'Expense', expense.id, { reason, amount: Number(expense.amount) });
  res.json(expense);
});
