import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuthService, type BrowserSupabaseClient } from '../src/services/supabase';

function makeClient() {
  const profile = { id: 'user-1', display_name: 'Demo User', default_currency: 'USD', preferences: {} };
  const client = {
    auth: {
      signUp: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1', email: 'user@example.test' }, session: null }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1', email: 'user@example.test' } }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: profile, error: null }) }) }),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: profile, error: null }) }) }) }),
    }),
  };
  return client as unknown as BrowserSupabaseClient;
}

describe('auth service', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost:5173' } });
  });

  it('registers without sending a role and supports email confirmation', async () => {
    const client = makeClient();
    const result = await createAuthService(client).register({ email: 'user@example.test', password: 'password123', displayName: 'Demo User' });
    expect(result.needsEmailConfirmation).toBe(true);
    expect(client.auth.signUp).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({ data: { display_name: 'Demo User' } }) }));
    expect(client.auth.signUp.mock.calls[0][0].options.data.role).toBeUndefined();
  });

  it('loads the authenticated user profile on sign-in', async () => {
    const client = makeClient();
    const context = await createAuthService(client).signIn('user@example.test', 'password123');
    expect(context.profile?.display_name).toBe('Demo User');
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'user@example.test', password: 'password123' });
  });
});
