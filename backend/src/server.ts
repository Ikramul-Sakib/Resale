import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { createSupabaseTokenVerifier } from './config/auth.js';
import { createSupabaseAdminClient } from './config/supabase.js';
import { createRepositories } from './repositories/supabase.js';
import { createServices } from './services/contracts.js';

const env = loadEnv();
const supabase = createSupabaseAdminClient(env);
const services = createServices(createRepositories(supabase));
const app = createApp({
  env,
  services,
  verifier: createSupabaseTokenVerifier(supabase),
});

app.listen(env.PORT, () => {
  console.log(`ResaleIQ API listening on port ${env.PORT}`);
});
