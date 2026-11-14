import {Router} from 'express';
import {prisma} from '../lib/prisma.js';

export const healthRouter = Router();

healthRouter.get('/health', async (_request, response) => {
  let database: 'ok' | 'unavailable' = 'ok';

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = 'unavailable';
  }

  const healthy = database === 'ok';
  response.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    checks: {database},
    timestamp: new Date().toISOString(),
  });
});
