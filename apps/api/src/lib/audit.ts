import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import { db } from './db.js';

export async function logActivity(req: Request, action: string, entityType: string, entityId?: string, details?: Record<string, unknown>) {
  try {
    await db.activityLog.create({ data: {
      userId: req.user?.id, action, entityType, entityId,
      details: details as Prisma.InputJsonValue | undefined,
      ipAddress: req.ip,
    } });
  } catch (error) {
    console.error('Could not write activity log', error);
  }
}
