import type { BrowserSupabaseClient } from './supabase';
import { getSupabaseClient } from './supabase';

export interface ApiErrorShape {
  code: string;
  message: string;
  request_id?: string;
  details?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly error: ApiErrorShape;

  constructor(status: number, error: ApiErrorShape) {
    super(error.message);
    this.name = 'ApiError';
    this.status = status;
    this.error = error;
  }
}

export interface ApiClient {
  request<T>(path: string, options?: RequestInit): Promise<T>;
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
}

function baseUrl(): string {
  return ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api/v1').replace(/\/$/, '');
}

export function createApiClient(supabase: BrowserSupabaseClient, fetcher: typeof fetch = fetch): ApiClient {
  async function request<T>(path: string, options: RequestInit = {}, canRefresh = true): Promise<T> {
    const { data } = await supabase.auth.getSession();
    const headers = new Headers(options.headers);
    headers.set('Accept', 'application/json');
    if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (data.session?.access_token) headers.set('Authorization', `Bearer ${data.session.access_token}`);

    const response = await fetcher(`${baseUrl()}${path.startsWith('/') ? path : `/${path}`}`, { ...options, headers });
    if (response.status === 401 && canRefresh) {
      const refreshed = await supabase.auth.refreshSession();
      if (refreshed.data.session) return request<T>(path, options, false);
      await supabase.auth.signOut();
    }

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (!response.ok) {
      const error = (payload as { error?: ApiErrorShape } | null)?.error ?? {
        code: 'API_ERROR',
        message: 'The request could not be completed.',
      };
      throw new ApiError(response.status, error);
    }
    return payload as T;
  }

  return {
    request,
    get: (path) => request(path),
    post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
    patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  };
}

export function getApiClient(): ApiClient {
  return createApiClient(getSupabaseClient());
}
