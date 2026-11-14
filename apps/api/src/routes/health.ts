import {Router} from 'express';
import {prisma} from '../lib/prisma.js';
import {env} from '../config/env.js';
import {isRateLimitStoreReady} from '../lib/rateLimit.js';

export const healthRouter = Router();

healthRouter.get('/health', async (_request, response) => {
  let database: 'ok' | 'unavailable' = 'ok';

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = 'unavailable';
  }

  const rateLimitStorage = isRateLimitStoreReady() ? 'shared' : env.NODE_ENV === 'production' ? 'unavailable' : 'local-fallback';
  const healthy = database === 'ok' && rateLimitStorage === 'shared';
  response.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    checks: {database, rateLimitStorage},
    timestamp: new Date().toISOString(),
  });
});
