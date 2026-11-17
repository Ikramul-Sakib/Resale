import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { createSupabaseTokenVerifier } from './config/auth.js';
import { createSupabaseAdminClient } from './config/supabase.js';
import { createRepositories } from './repositories/supabase.js';
import { createServices } from './services/contracts.js';
import { createGeminiService } from './services/gemini/index.js';
import { ScanService } from './services/scans.js';
import { PricingService } from './services/pricing/service.js';
import { NotConfiguredMarketDataProvider } from './services/pricing/market-data.js';

const env = loadEnv();
const supabase = createSupabaseAdminClient(env);
const repositories = createRepositories(supabase);
const gemini = createGeminiService({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL, timeoutMs: env.GEMINI_TIMEOUT_MS, maxRetries: env.GEMINI_MAX_RETRIES, mock: env.GEMINI_MOCK });
const services = createServices(repositories, new ScanService(repositories, gemini), new PricingService(repositories, gemini, new NotConfiguredMarketDataProvider(), { modelId: env.GEMINI_MODEL, promptVersion: 'pricing-v1' }));
const app = createApp({
  env,
  services,
  verifier: createSupabaseTokenVerifier(supabase),
});

app.listen(env.PORT, () => {
  console.log(`ResaleIQ API listening on port ${env.PORT}`);
});
