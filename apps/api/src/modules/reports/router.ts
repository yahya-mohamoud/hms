import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../lib/db.js';
import { HttpError } from '../../lib/errors.js';
import { logActivity } from '../../lib/audit.js';
import { allowRoles } from '../../middleware/auth.js';

export const reportsRouter = Router();
function day(date: string) { return new Date(`${date}T00:00:00.000Z`); }
reportsRouter.get('/dashboard', allowRoles('ADMIN','MANAGER','RECEPTIONIST'), async (req, res) => {
  const date = typeof req.query.date === 'string' ? req.query.date : new Date().toISOString().slice(0,10);
  const start = day(date), end = new Date(start.getTime() + 86400000);
  const [arrivals, departures, occupied, rooms, inHouse, tasks, payments] = await Promise.all([
    db.reservation.findMany({ where: { arrivalDate: start, status: { in: ['PENDING','CONFIRMED'] } }, include: { guest: true, room: true }, orderBy: { arrivalDate: 'asc' } }),
    db.stay.findMany({ where: { status: 'IN_HOUSE', expectedCheckOut: start }, include: { guest: true, room: true } }),
    db.room.count({ where: { status: 'OCCUPIED', active: true } }),
    db.room.findMany({ where: { active: true }, orderBy: { number: 'asc' } }),
    db.stay.count({ where: { status: 'IN_HOUSE' } }),
    db.housekeepingTask.count({ where: { status: { not: 'DONE' } } }),
    db.payment.aggregate({ where: { receivedAt: { gte: start, lt: end } }, _sum: { amount: true } }),
  ]);
  res.json({ date, arrivals, departures, occupancy: { occupied, total: rooms.length, percent: rooms.length ? Math.round(occupied / rooms.length * 100) : 0 }, inHouse, openHousekeepingTasks: tasks, paymentsToday: Number(payments._sum.amount ?? 0), rooms });
});
reportsRouter.get('/revenue', allowRoles('ADMIN','MANAGER','RECEPTIONIST'), async (req, res) => {
  const d = z.object({ from: z.string().date(), to: z.string().date() }).parse(req.query);
  const from = day(d.from), to = new Date(day(d.to).getTime() + 86400000);
  if (from >= to) throw new HttpError(400, 'Invalid date range');
  const [items, payments, days] = await Promise.all([
    db.folioItem.findMany({ where: { postedAt: { gte: from, lt: to } }, include: { folio: { include: { stay: { include: { room: true } } } } } }),
    db.payment.findMany({ where: { receivedAt: { gte: from, lt: to } } }),
    db.stay.findMany({ where: { checkInAt: { lt: to }, OR: [{ checkOutAt: null }, { checkOutAt: { gte: from } }] }, select: { checkInAt: true, checkOutAt: true } }),
  ]);
  const roomRevenue = items.filter(i => i.type === 'ROOM_CHARGE').reduce((n,i) => n + Number(i.amount),0);
  const otherRevenue = items.filter(i => i.type !== 'ROOM_CHARGE').reduce((n,i) => n + Number(i.amount),0);
  const totalPayments = payments.reduce((n,p) => n + Number(p.amount),0);
  const occupiedNights = days.reduce((total,s) => {
    const start = Math.max(from.getTime(), new Date(s.checkInAt).getTime());
    const end = Math.min(to.getTime(), s.checkOutAt ? new Date(s.checkOutAt).getTime() : to.getTime());
    return total + Math.max(0, Math.ceil((end-start)/86400000));
  },0);
  res.json({ from: d.from, to: d.to, roomRevenue, otherRevenue, totalRevenue: roomRevenue + otherRevenue, payments: totalPayments, occupiedNights, occupancyPercent: Math.round(occupiedNights / (Math.ceil((to-from)/86400000) * 12) * 100) });
});
reportsRouter.get('/guest-insights', allowRoles('ADMIN','MANAGER','RECEPTIONIST'), async (_req, res) => {
  const guests = await db.guest.findMany({ include: { stays: { where: { status: 'CHECKED_OUT' }, orderBy: { checkOutAt: 'desc' }, include: { folio: { include: { payments: true } } } } } });
  const ranked = guests.map(g => {
    const stays = g.stays;
    const nights = stays.reduce((sum,s) => sum + (s.checkOutAt ? Math.max(0, Math.ceil((s.checkOutAt.getTime()-s.checkInAt.getTime())/86400000)) : 0),0);
    const revenue = stays.reduce((sum,s) => sum + (s.folio?.payments.reduce((p,x) => p+Number(x.amount),0) ?? 0),0);
    return { id: g.id, name: `${g.firstName} ${g.lastName}`, phone: g.phone, totalStays: stays.length, totalNights: nights, totalSpent: revenue, lastStayDate: stays[0]?.checkOutAt ?? null };
  }).filter(g => g.totalStays > 0);
  res.json({ topByStays: [...ranked].sort((a,b) => b.totalStays-a.totalStays).slice(0,10), topByNights: [...ranked].sort((a,b) => b.totalNights-a.totalNights).slice(0,10), topByRevenue: [...ranked].sort((a,b) => b.totalSpent-a.totalSpent).slice(0,10), repeatGuests: ranked.filter(g => g.totalStays >= 2).sort((a,b) => b.totalStays-a.totalStays), recentRepeatGuests: ranked.filter(g => g.totalStays >= 2).sort((a,b) => new Date(b.lastStayDate ?? 0).getTime()-new Date(a.lastStayDate ?? 0).getTime()).slice(0,10) });
});
reportsRouter.get('/audit-log', allowRoles('ADMIN','MANAGER'), async (req, res) => {
  const items = await db.activityLog.findMany({ include: { user: { select: { name: true, email: true, role: true } } }, orderBy: { createdAt: 'desc' }, take: Math.min(Number(req.query.limit) || 100, 500) });
  res.json(items);
});
reportsRouter.post('/daily-close', allowRoles('ADMIN','MANAGER'), async (req, res) => {
  const { businessDate, notes } = z.object({ businessDate: z.string().date(), notes: z.string().max(2000).optional() }).parse(req.body);
  const start = day(businessDate), end = new Date(start.getTime()+86400000);
  const [rooms, arrivals, departures, roomCharges, otherCharges, payments, folios] = await Promise.all([
    db.room.count({ where: { active: true, status: 'OCCUPIED' } }),
    db.reservation.count({ where: { arrivalDate: start, status: 'CHECKED_IN' } }),
    db.stay.count({ where: { checkOutAt: { gte: start, lt: end } } }),
    db.folioItem.aggregate({ where: { type: 'ROOM_CHARGE', postedAt: { gte: start, lt: end } }, _sum: { amount: true } }),
    db.folioItem.aggregate({ where: { type: { not: 'ROOM_CHARGE' }, postedAt: { gte: start, lt: end } }, _sum: { amount: true } }),
    db.payment.aggregate({ where: { receivedAt: { gte: start, lt: end } }, _sum: { amount: true } }),
    db.folio.findMany({ include: { items: true, payments: true } }),
  ]);
  const outstanding = folios.reduce((total,f) => total + f.items.reduce((n,i) => n+Number(i.amount),0) - f.payments.reduce((n,p) => n+Number(p.amount),0),0);
  const report = await db.dailyAudit.upsert({ where: { businessDate: start }, create: { businessDate: start, openingRooms: 12, occupiedRooms: rooms, arrivals, departures, roomRevenue: roomCharges._sum.amount ?? 0, otherRevenue: otherCharges._sum.amount ?? 0, paymentsTotal: payments._sum.amount ?? 0, outstandingTotal: outstanding, closedById: req.user?.id, notes }, update: { occupiedRooms: rooms, arrivals, departures, roomRevenue: roomCharges._sum.amount ?? 0, otherRevenue: otherCharges._sum.amount ?? 0, paymentsTotal: payments._sum.amount ?? 0, outstandingTotal: outstanding, closedById: req.user?.id, closedAt: new Date(), notes } });
  await logActivity(req, 'daily.close_completed', 'DailyAudit', report.id, { businessDate });
  res.json(report);
});
