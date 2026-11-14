import cors from 'cors';
import express, {type ErrorRequestHandler} from 'express';
import helmet from 'helmet';
import {randomUUID} from 'node:crypto';
import {pinoHttp} from 'pino-http';
import {env} from './config/env.js';
import {logger} from './lib/logger.js';
import {apiErrorHandler, HttpError} from './lib/http.js';
import {authRateLimit} from './lib/rateLimit.js';
import {authRouter} from './routes/auth.js';
import {healthRouter} from './routes/health.js';
import {listingsRouter} from './routes/listings.js';
import {tourRequestsRouter} from './routes/tourRequests.js';
import {conversationsRouter} from './routes/conversations.js';
import {notificationsRouter} from './routes/notifications.js';
import {discoveryRouter} from './routes/discovery.js';
import {safetyRouter} from './routes/safety.js';
import {listingMediaRouter} from './routes/listingMedia.js';
import {accountDataRouter} from './routes/accountData.js';
import {communityRouter} from './routes/community.js';

export const app = express();

app.disable('x-powered-by');
if (env.TRUST_PROXY_HOPS > 0) app.set('trust proxy', env.TRUST_PROXY_HOPS);
app.use(helmet());
app.use(
  cors({
    origin: env.WEB_ORIGIN,
    credentials: true,
  }),
);
app.use(express.json({limit: '1mb'}));
app.use(
  pinoHttp({
    logger,
    quietReqLogger: true,
    genReqId: (_request, response) => {
      const id = randomUUID();
      response.setHeader('x-request-id', id);
      return id;
    },
  }),
);
app.use((request, _response, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && request.get('origin') !== env.WEB_ORIGIN) {
    next(new HttpError(403, 'ORIGIN_NOT_ALLOWED', 'Request origin is not allowed.'));
    return;
  }
  next();
});

app.get('/api/v1/health/live', (_request, response) => {
  response.json({status: 'ok', timestamp: new Date().toISOString()});
});
app.use('/api/v1/auth', authRateLimit);
app.use('/api/v1/account', authRateLimit);
app.use('/api/v1', authRouter);
app.use('/api/v1', listingsRouter);
app.use('/api/v1', listingMediaRouter);
app.use('/api/v1', tourRequestsRouter);
app.use('/api/v1', conversationsRouter);
app.use('/api/v1', notificationsRouter);
app.use('/api/v1', discoveryRouter);
app.use('/api/v1', safetyRouter);
app.use('/api/v1', accountDataRouter);
app.use('/api/v1', communityRouter);
app.use('/api/v1', healthRouter);

app.use((_request, response) => {
  response.status(404).json({error: {code: 'NOT_FOUND', message: 'Route not found.'}});
});

const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  const requestId = response.getHeader('x-request-id');
  response.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
      ...(requestId ? {requestId} : {}),
    },
  });
  request.log?.error(
    {errorName: error instanceof Error ? error.name : 'UnknownError'},
    'Unhandled API error',
  );
};

app.use(apiErrorHandler);
app.use(errorHandler);
