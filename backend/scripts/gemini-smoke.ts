import fs from 'node:fs/promises';
import path from 'node:path';
import { loadEnv } from '../src/config/env.js';
import { createGeminiService } from '../src/services/gemini/index.js';
import { validateUploadedImages } from '../src/services/image-validation.js';

const filePath = process.argv[2];
if (!filePath) throw new Error('Usage: npm run gemini:smoke -- <path-to-jpg-png-or-webp>');

const env = loadEnv();
if (!env.GEMINI_API_KEY || !env.GEMINI_MODEL || env.GEMINI_MOCK) throw new Error('Set GEMINI_API_KEY and GEMINI_MODEL, and set GEMINI_MOCK=false, to run a real Gemini call.');
const bytes = await fs.readFile(path.resolve(filePath));
const [image] = validateUploadedImages([{ buffer: bytes, originalname: path.basename(filePath) }]);
if (!image) throw new Error('The supplied file is not a supported image.');
const service = createGeminiService({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL, timeoutMs: env.GEMINI_TIMEOUT_MS, maxRetries: env.GEMINI_MAX_RETRIES });
const result = await service.identifyProduct([{ bytes: image.buffer, mimeType: image.mimeType }]);
console.log(JSON.stringify({ mode: service.mode, model_configured: true, result }, null, 2));
