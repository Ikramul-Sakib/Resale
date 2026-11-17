import type { AuthenticatedUser } from './index.js';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: AuthenticatedUser;
      validated?: {
        body?: unknown;
        params?: unknown;
        query?: unknown;
      };
    }
  }
}

export {};
