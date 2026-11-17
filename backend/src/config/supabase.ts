import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AppEnv } from './env.js';

export type SupabaseDatabaseClient = SupabaseClient<any, 'public', any>;

export function createSupabaseAdminClient(env: AppEnv): SupabaseDatabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
