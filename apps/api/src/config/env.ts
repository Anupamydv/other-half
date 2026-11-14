import {z} from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  WEB_ORIGIN: z.url().default('http://localhost:3000'),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
  DATABASE_URL: z.string().regex(/^postgres(?:ql)?:\/\//, 'Must be a PostgreSQL connection URL'),
  REDIS_URL: z.url().optional(),
  MEDIA_S3_ENDPOINT: z.url().optional(),
  MEDIA_S3_PUBLIC_ENDPOINT: z.url().optional(),
  MEDIA_S3_REGION: z.string().trim().min(1).default('us-east-1'),
  MEDIA_S3_ACCESS_KEY: z.string().trim().min(1).optional(),
  MEDIA_S3_SECRET_KEY: z.string().min(1).optional(),
  MEDIA_S3_BUCKET: z.string().trim().min(3).max(63).default('other-half-media'),
}).superRefine((value, context) => {
  const storageValues = [value.MEDIA_S3_ENDPOINT, value.MEDIA_S3_PUBLIC_ENDPOINT, value.MEDIA_S3_ACCESS_KEY, value.MEDIA_S3_SECRET_KEY];
  if (storageValues.some(Boolean) && !storageValues.every(Boolean)) {
    context.addIssue({code: 'custom', path: ['MEDIA_S3_ENDPOINT'], message: 'Configure both S3 endpoints and credentials, or leave all four unset.'});
  }
  if (value.NODE_ENV === 'production' && !value.REDIS_URL) {
    context.addIssue({code: 'custom', path: ['REDIS_URL'], message: 'REDIS_URL is required in production for shared account rate limiting.'});
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n');
  throw new Error(`Invalid server configuration:\n${details}`);
}

export const env = parsed.data;
