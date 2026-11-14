import {app} from './app.js';
import {env} from './config/env.js';
import {logger} from './lib/logger.js';
import {prisma} from './lib/prisma.js';
import {closeRateLimitStore, initializeRateLimitStore} from './lib/rateLimit.js';

const rateLimitStoreReady = await initializeRateLimitStore();
if (!rateLimitStoreReady && env.NODE_ENV === 'production') {
  throw new Error('Redis must be available before starting the production API.');
}

const server = app.listen(env.API_PORT, '0.0.0.0', () => {
  logger.info({port: env.API_PORT}, 'Other Half API started');
});

async function shutdown(signal: string) {
  logger.info({signal}, 'Graceful shutdown started');
  server.close(async (error) => {
    await Promise.all([prisma.$disconnect(), closeRateLimitStore()]);
    if (error) {
      logger.error({errorName: error.name}, 'API shutdown failed');
      process.exitCode = 1;
    }
  });
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
