import type { ErrorRequestHandler, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(new AppError(404, 'NOT_FOUND', `Route not found: ${req.method} ${req.path}`));
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const requestId = (req as Request & { requestId?: string }).requestId ?? 'unknown';
  let appError: AppError;

  if (error instanceof AppError) {
    appError = error;
  } else if (error instanceof ZodError) {
    appError = new AppError(400, 'VALIDATION_ERROR', 'Request validation failed.', error.issues.map((issue) => ({
      path: issue.path,
      message: issue.message,
    })));
  } else if (error?.type === 'entity.parse.failed') {
    appError = new AppError(400, 'INVALID_JSON', 'The request body contains invalid JSON.');
  } else if (error?.type === 'entity.too.large') {
    appError = new AppError(413, 'PAYLOAD_TOO_LARGE', 'The request body is too large.');
  } else {
    appError = new AppError(500, 'INTERNAL_ERROR', 'An unexpected error occurred.');
  }

  if (appError.statusCode >= 500) {
    console.error(JSON.stringify({ requestId, code: appError.code, message: appError.message }));
  }

  const body: { error: { code: string; message: string; request_id: string; details?: unknown } } = {
    error: {
      code: appError.code,
      message: appError.message,
      request_id: requestId,
    },
  };
  if (appError.details !== undefined) body.error.details = appError.details;
  res.status(appError.statusCode).json(body);
};
