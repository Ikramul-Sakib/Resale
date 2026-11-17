import fs from 'node:fs/promises';
import path from 'node:path';
import { loadEnv } from '../src/config/env.js';
import { createGeminiService } from '../src/services/gemini/index.js';
import type { ConfirmedListingItem } from '../src/services/gemini/types.js';

const filePath = process.argv[2];
if (!filePath) throw new Error('Usage: npm run gemini:listing-smoke -- <confirmed-listing-json>');
const env = loadEnv();
if (!env.GEMINI_API_KEY || !env.GEMINI_MODEL || env.GEMINI_MOCK) throw new Error('Set GEMINI_API_KEY and GEMINI_MODEL, and set GEMINI_MOCK=false, to run a real Gemini call.');
const item = JSON.parse(await fs.readFile(path.resolve(filePath), 'utf8')) as ConfirmedListingItem;
const service = createGeminiService({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL, timeoutMs: env.GEMINI_TIMEOUT_MS, maxRetries: env.GEMINI_MAX_RETRIES });
const result = await service.generateListing(item);
console.log(JSON.stringify({ mode: service.mode, model_configured: true, currency: item.currency, result }, null, 2));
