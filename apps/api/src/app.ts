import cors from 'cors';
import express, {type ErrorRequestHandler} from 'express';
import helmet from 'helmet';
import {randomUUID} from 'node:crypto';
import {pinoHttp} from 'pino-http';
import {env} from './config/env.js';
import {logger} from './lib/logger.js';
import {healthRouter} from './routes/health.js';

export const app = express();

app.disable('x-powered-by');
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

app.get('/api/v1/health/live', (_request, response) => {
  response.json({status: 'ok', timestamp: new Date().toISOString()});
});
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
  request.log.error(
    {errorName: error instanceof Error ? error.name : 'UnknownError'},
    'Unhandled API error',
  );
};

app.use(errorHandler);
