import type { NextFunction, Response } from 'express';
import type { RequestWithContext, AuthenticatedUser } from '../types/index.js';
import { AppError } from '../utils/errors.js';

export interface TokenVerifier {
  verify(token: string): Promise<AuthenticatedUser>;
}

export function createAuthMiddleware(verifier: TokenVerifier) {
  return async function requireAuth(req: RequestWithContext, _res: Response, next: NextFunction): Promise<void> {
    const header = req.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) return next(new AppError(401, 'UNAUTHORIZED', 'A valid bearer token is required.'));

    try {
      req.user = await verifier.verify(token);
      return next();
    } catch {
      return next(new AppError(401, 'UNAUTHORIZED', 'A valid bearer token is required.'));
    }
  };
}
