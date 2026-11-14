import {createHash} from 'node:crypto';
import {createClient} from 'redis';
import type {RequestHandler} from 'express';
import {env} from '../config/env.js';
import {logger} from './logger.js';

const WINDOW_MS = 15 * 60 * 1000;
const REQUEST_LIMIT = 12;
const redis = createClient({
  url: env.REDIS_URL ?? 'redis://localhost:6379',
  socket: {connectTimeout: 3000, reconnectStrategy: (retries) => retries < 3 ? Math.min((retries + 1) * 250, 1000) : false},
});
redis.on('error', (error) => logger.error({errorName: error.name}, 'Shared rate-limit storage error'));

const localFallback = new Map<string, {count: number; resetAt: number}>();
let connectAttempt: Promise<boolean> | null = null;

async function connectStore() {
  if (redis.isReady) return true;
  if (!connectAttempt) {
    connectAttempt = redis.connect().then(() => true).catch(() => false).finally(() => {connectAttempt = null;});
  }
  return connectAttempt;
}

export async function initializeRateLimitStore() {
  const connected = await connectStore();
  if (!connected && env.NODE_ENV !== 'production') {
    logger.warn('Redis is unavailable; using per-process rate limits for local development.');
  }
  return connected;
}

export function isRateLimitStoreReady() {
  return redis.isReady;
}

export async function closeRateLimitStore() {
  if (redis.isOpen) await redis.quit();
}

function setRateLimitHeaders(response: Parameters<RequestHandler>[1], remaining: number, resetSeconds: number) {
  response.setHeader('RateLimit-Limit', REQUEST_LIMIT);
  response.setHeader('RateLimit-Remaining', Math.max(0, remaining));
  response.setHeader('RateLimit-Reset', resetSeconds);
}

function consumeLocal(key: string) {
  const now = Date.now();
  let bucket = localFallback.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = {count: 0, resetAt: now + WINDOW_MS};
    localFallback.set(key, bucket);
  }
  bucket.count += 1;
  if (localFallback.size > 10_000) {
    for (const [itemKey, item] of localFallback) if (item.resetAt <= now) localFallback.delete(itemKey);
  }
  return {count: bucket.count, resetMs: Math.max(0, bucket.resetAt - now)};
}

export const authRateLimit: RequestHandler = async (request, response, next) => {
  const ipDigest = createHash('sha256').update(request.ip ?? 'unknown').digest('hex');
  const now = Date.now();
  const windowStart = Math.floor(now / WINDOW_MS) * WINDOW_MS;
  const key = `other-half:auth-rate:${windowStart}:${ipDigest}`;
  let result: {count: number; resetMs: number};

  if (await connectStore()) {
    try {
      const script = "local count = redis.call('INCR', KEYS[1]); if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); end; return {count, redis.call('PTTL', KEYS[1])}";
      const reply = await redis.eval(script, {keys: [key], arguments: [String(WINDOW_MS)]});
      if (!Array.isArray(reply)) throw new Error('Unexpected Redis rate-limit response.');
      result = {count: Number(reply[0]), resetMs: Number(reply[1])};
    } catch (error) {
      logger.error({errorName: error instanceof Error ? error.name : 'UnknownError'}, 'Shared rate-limit request failed');
      if (env.NODE_ENV === 'production') {
        response.status(503).json({error: {code: 'RATE_LIMIT_STORE_UNAVAILABLE', message: 'Account security service is temporarily unavailable. Please retry shortly.'}});
        return;
      }
      result = consumeLocal(key);
    }
  } else if (env.NODE_ENV === 'production') {
    response.status(503).json({error: {code: 'RATE_LIMIT_STORE_UNAVAILABLE', message: 'Account security service is temporarily unavailable. Please retry shortly.'}});
    return;
  } else {
    result = consumeLocal(key);
  }

  const resetSeconds = Math.ceil(result.resetMs / 1000);
  setRateLimitHeaders(response, REQUEST_LIMIT - result.count, resetSeconds);
  if (result.count > REQUEST_LIMIT) {
    response.setHeader('Retry-After', resetSeconds);
    response.status(429).json({error: {code: 'RATE_LIMITED', message: 'Too many account requests. Try again later.'}});
    return;
  }
  next();
};
