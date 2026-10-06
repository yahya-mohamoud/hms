import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(4000),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('12h'),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: z.string().min(1).optional(),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  S3_FORCE_PATH_STYLE: z.enum(['true', 'false']).default('false'),
}).superRefine((config, ctx) => {
  const storageParts = [config.S3_ENDPOINT, config.S3_BUCKET, config.S3_ACCESS_KEY_ID, config.S3_SECRET_ACCESS_KEY];
  const storageConfigured = storageParts.some(Boolean);
  if (storageConfigured && storageParts.some(value => !value)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['S3_BUCKET'], message: 'Configure the endpoint, bucket, access key, and secret key together' });
  }
  if (process.env.NODE_ENV === 'production') {
    if (config.JWT_SECRET.toLowerCase().includes('replace')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['JWT_SECRET'], message: 'Use a generated production JWT secret' });
    }
    if (!storageConfigured || !config.S3_ENDPOINT?.startsWith('https://') || !config.S3_ENDPOINT.endsWith('.r2.cloudflarestorage.com')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['S3_ENDPOINT'], message: 'Production ID storage must be configured with a private Cloudflare R2 bucket' });
    }
  }
});

export const env = envSchema.parse(process.env);
