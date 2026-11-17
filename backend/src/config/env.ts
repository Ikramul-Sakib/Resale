import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(moduleDirectory, '../../../.env') });
loadDotenv();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CORS_ORIGIN: z.string().min(1),
  JSON_BODY_LIMIT: z.string().min(1).default('1mb'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().trim().min(1).optional(),
  GEMINI_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  GEMINI_MAX_RETRIES: z.coerce.number().int().min(0).max(3).default(2),
  GEMINI_MOCK: z.string().optional().default('false').transform((value) => value.toLowerCase() === 'true'),
}).superRefine((value, context) => {
  if (value.GEMINI_API_KEY && !value.GEMINI_MODEL) {
    context.addIssue({ code: 'custom', path: ['GEMINI_MODEL'], message: 'GEMINI_MODEL is required when GEMINI_API_KEY is set.' });
  }
});

export type AppEnv = z.infer<typeof envSchema> & { corsOrigins: string[] };

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Environment validation failed. Set the required backend variables: ${issues}`);
  }

  const corsOrigins = result.data.CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (corsOrigins.length === 0) {
    throw new Error('Environment validation failed. CORS_ORIGIN must contain at least one origin.');
  }

  return { ...result.data, corsOrigins };
}
