import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from '../src/services/api';
import type { BrowserSupabaseClient } from '../src/services/supabase';

function response(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('API client', () => {
  it('attaches the current access token', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(200, { ok: true }));
    const supabase = { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'token-a' } } }), refreshSession: vi.fn(), signOut: vi.fn() } } as unknown as BrowserSupabaseClient;
    await createApiClient(supabase, fetcher).get('/auth/me');
    expect(fetcher.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer token-a');
  });

  it('refreshes once after a 401 and retries with the new token', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(401, { error: { code: 'UNAUTHORIZED', message: 'expired' } })).mockResolvedValueOnce(response(200, { ok: true }));
    const supabase = { auth: { getSession: vi.fn().mockResolvedValueOnce({ data: { session: { access_token: 'old-token' } } }).mockResolvedValueOnce({ data: { session: { access_token: 'new-token' } } }), refreshSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'new-token' } } }), signOut: vi.fn() } } as unknown as BrowserSupabaseClient;
    await createApiClient(supabase, fetcher).get('/auth/me');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[1][1].headers.get('Authorization')).toBe('Bearer new-token');
  });

  it('returns the backend error shape and signs out when refresh fails', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(401, { error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }));
    const signOut = vi.fn().mockResolvedValue({});
    const supabase = { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }), refreshSession: vi.fn().mockResolvedValue({ data: { session: null } }), signOut } } as unknown as BrowserSupabaseClient;
    await expect(createApiClient(supabase, fetcher).get('/auth/me')).rejects.toEqual(expect.objectContaining({ status: 401, error: expect.objectContaining({ code: 'UNAUTHORIZED' }) } satisfies Partial<ApiError>));
    expect(signOut).toHaveBeenCalledOnce();
  });
});
