import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { db } from '../../lib/db.js';
import { HttpError } from '../../lib/errors.js';
import { logActivity } from '../../lib/audit.js';
import { allowRoles } from '../../middleware/auth.js';

export const documentsRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024, files: 1 }, fileFilter: (_req, file, done) => {
  if (!['image/jpeg','image/png','image/webp'].includes(file.mimetype)) return done(new HttpError(400, 'Upload a JPG, PNG, or WebP image'));
  done(null, true);
} });
const s3 = new S3Client({ region: env.S3_REGION, endpoint: env.S3_ENDPOINT, forcePathStyle: env.S3_FORCE_PATH_STYLE === 'true', credentials: env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY } : undefined });

documentsRouter.post('/:guestId/documents', allowRoles('ADMIN','MANAGER','RECEPTIONIST'), upload.single('image'), async (req, res) => {
  if (!env.S3_BUCKET) throw new HttpError(503, 'Private ID image storage is not configured');
  const file = req.file;
  if (!file) throw new HttpError(400, 'Choose an ID image');
  const { documentType } = z.object({ documentType: z.enum(['NATIONAL_ID','PASSPORT','DRIVERS_LICENSE','OTHER']).default('OTHER') }).parse(req.body);
  if (!await db.guest.findUnique({ where: { id: req.params.guestId }, select: { id: true } })) throw new HttpError(404, 'Guest not found');
  let width = 1000, quality = 68, output: Buffer;
  do {
    output = await sharp(file.buffer, { failOn: 'error' }).rotate().resize({ width, height: 1000, fit: 'inside', withoutEnlargement: true }).webp({ quality, effort: 5 }).toBuffer();
    if (output.length <= 150 * 1024) break;
    if (quality > 52) quality -= 5; else width = Math.max(600, Math.round(width * 0.85));
  } while (width >= 600);
  if (output!.length > 300 * 1024) throw new HttpError(413, 'Could not compress this image enough; please take a clearer photo');
  const objectKey = `guest-ids/${req.params.guestId}/${randomUUID()}.webp`;
  await s3.send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey, Body: output!, ContentType: 'image/webp', CacheControl: 'private, no-store' }));
  const document = await db.guestDocument.create({ data: { guestId: req.params.guestId, objectKey, originalName: file.originalname.slice(0, 200), sizeBytes: output!.length, documentType, uploadedById: req.user?.id } });
  await logActivity(req, 'guest.id_document_uploaded', 'GuestDocument', document.id, { sizeBytes: output!.length });
  res.status(201).json({ ...document, signedUrl: await getSignedUrl(s3, new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey }), { expiresIn: 300 }) });
});
documentsRouter.get('/documents/:id/url', allowRoles('ADMIN','MANAGER','RECEPTIONIST'), async (req, res) => {
  if (!env.S3_BUCKET) throw new HttpError(503, 'Private ID image storage is not configured');
  const doc = await db.guestDocument.findUnique({ where: { id: req.params.id } });
  if (!doc) throw new HttpError(404, 'Document not found');
  res.json({ url: await getSignedUrl(s3, new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: doc.objectKey }), { expiresIn: 300 }), expiresIn: 300 });
});
