import type {ErrorRequestHandler, RequestHandler} from 'express';

export class HttpError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export function asyncRoute(handler: RequestHandler): RequestHandler {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

export const apiErrorHandler: ErrorRequestHandler = (error, _request, response, next) => {
  if (response.headersSent) return next(error);
  if (error instanceof HttpError) {
    return response.status(error.status).json({error: {code: error.code, message: error.message}});
  }
  if (error instanceof SyntaxError && 'body' in error) {
    return response.status(400).json({error: {code: 'INVALID_JSON', message: 'Request body must be valid JSON.'}});
  }
  if (error && typeof error === 'object' && 'type' in error && error.type === 'entity.too.large') {
    return response.status(413).json({error: {code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.'}});
  }
  return next(error);
};
