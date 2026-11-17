import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import type { AppEnv } from './config/env.js';
import type { TokenVerifier } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestId } from './middleware/requestId.js';
import type { Services } from './services/contracts.js';
import { createApiRouter } from './routes/index.js';
import { AppError } from './utils/errors.js';

export interface AppOptions {
  env: Pick<AppEnv, 'corsOrigins' | 'JSON_BODY_LIMIT' | 'RATE_LIMIT_WINDOW_MS' | 'RATE_LIMIT_MAX'>;
  services: Services;
  verifier: TokenVerifier;
}

export function createApp(options: AppOptions): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(requestId);
  app.use(cors({
    origin(origin, callback) {
      if (!origin || options.env.corsOrigins.includes(origin)) return callback(null, true);
      return callback(new AppError(403, 'CORS_ORIGIN_DENIED', 'The request origin is not allowed.'));
    },
  }));
  app.use(express.json({ limit: options.env.JSON_BODY_LIMIT }));
  app.use(rateLimit({
    windowMs: options.env.RATE_LIMIT_WINDOW_MS,
    limit: options.env.RATE_LIMIT_MAX,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many requests.' } },
  }));

  app.get('/health', (_req, res) => res.status(200).json({ status: 'ok', service: 'resaleiq-api' }));
  app.use('/api/v1', createApiRouter(options.services, options.verifier));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
