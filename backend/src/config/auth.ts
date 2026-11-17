import type { SupabaseDatabaseClient } from './supabase.js';
import type { TokenVerifier } from '../middleware/auth.js';

export function createSupabaseTokenVerifier(client: SupabaseDatabaseClient): TokenVerifier {
  return {
    async verify(token) {
      const { data, error } = await client.auth.getUser(token);
      if (error || !data.user) throw new Error('Invalid token');
      return { id: data.user.id, email: data.user.email };
    },
  };
}
