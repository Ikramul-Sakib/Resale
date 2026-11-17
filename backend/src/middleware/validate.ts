import type { NextFunction, Response } from 'express';
import type { RequestWithContext } from '../types/index.js';
import { AppError } from '../utils/errors.js';
import type { ZodType } from 'zod';

type Source = 'body' | 'params' | 'query';

export function validate(source: Source, schema: ZodType) {
  return (req: RequestWithContext, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(new AppError(400, 'VALIDATION_ERROR', 'Request validation failed.', result.error.issues.map((issue) => ({
        path: issue.path,
        message: issue.message,
      }))));
    }
    req.validated ??= {};
    req.validated[source] = result.data;
    next();
  };
}
