import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import { ZodError } from 'zod';
import { HttpError } from '../lib/errors.js';

export const notFound: RequestHandler = (_req, res) => { res.status(404).json({ error: 'Not found' }); };
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) return res.status(400).json({ error: 'Invalid request', details: error.flatten() });
  if (error instanceof multer.MulterError) return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'ID photo must be 12 MB or smaller' : 'Invalid image upload' });
  if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return res.status(409).json({ error: 'A record with these details already exists' });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') return res.status(409).json({ error: 'This room or record changed during the request. Refresh and try again.' });
  console.error(error);
  return res.status(500).json({ error: 'Something went wrong. Please try again.' });
};
