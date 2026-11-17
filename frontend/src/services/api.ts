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
  uploadScan(files: File[], source?: 'upload' | 'camera', onProgress?: (percent: number) => void): Promise<ScanResponse>;
}

export interface ScanImage {
  id: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  byte_size: number;
  sort_order: number;
  signed_url?: string;
}

export interface IdentifiedItem {
  id: string;
  scan_id: string;
  name: string;
  brand_text?: string | null;
  model?: string | null;
  category_text?: string | null;
  product_type?: string | null;
  condition?: string | null;
  key_attributes: Record<string, unknown>;
  confidence_score?: number | null;
  identification_notes?: string | null;
  identification_source?: 'gemini' | 'mock';
  review_status?: 'needs_review' | 'reviewed';
}

export interface ScanResponse {
  id: string;
  status: 'uploaded' | 'identifying' | 'identified' | 'estimating' | 'completed' | 'failed';
  source: 'upload' | 'camera' | 'demo';
  error_message?: string | null;
  images: ScanImage[];
  identified_item?: IdentifiedItem | null;
  ai_mode: 'real' | 'mock';
  identification_empty: boolean;
}

export interface PriceFactor { label: string; impact_type: 'percentage' | 'amount'; impact: number; }
export interface PriceEstimate {
  id: string; identified_item_id: string; scan_id: string; low: number; typical: number; high: number;
  suggested_price?: number; suggested_selling_price?: number; currency: string; explanation: string;
  factors: { items?: PriceFactor[] } | PriceFactor[]; methodology: string; data_source: string;
  model_id?: string | null; prompt_version?: string; uncertainty_note?: string | null;
  estimated_fee_amount?: number | null; estimated_net_earnings?: number | null; market_data_status?: 'not_connected' | 'connected';
  fee_rule_status?: string; created_at: string; updated_at: string;
}
export interface FeeResult { status: 'verified' | 'user_entered_unverified'; fee_amount: number; rule?: { name: string; source: string; verified_at?: string | null; percentage_rate?: number | null } | null; }
export interface EstimateResponse { estimate: PriceEstimate; ai_mode: 'real' | 'mock'; market_data_status: 'not_connected' | 'connected'; fee: { status: string; fee_amount: number; rule?: unknown } | null; cached?: boolean; }
export interface Marketplace { id: string; name: string; slug: string; is_active: boolean; }

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
    uploadScan: async (files, source = 'upload', onProgress) => {
      const send = async (canRefresh: boolean): Promise<ScanResponse> => {
        const { data } = await supabase.auth.getSession();
        const formData = new FormData();
        files.forEach((file) => formData.append('images', file, file.name));
        formData.append('source', source);
        const response = await new Promise<Response>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `${baseUrl()}/scans`);
          xhr.setRequestHeader('Accept', 'application/json');
          if (data.session?.access_token) xhr.setRequestHeader('Authorization', `Bearer ${data.session.access_token}`);
          xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100)); };
          xhr.onerror = () => reject(new Error('The upload could not be completed.'));
          xhr.ontimeout = () => reject(new Error('The upload timed out.'));
          xhr.onload = () => resolve(new Response(xhr.responseText, { status: xhr.status, headers: { 'Content-Type': xhr.getResponseHeader('Content-Type') ?? 'application/json' } }));
          xhr.send(formData);
        });
        if (response.status === 401 && canRefresh) {
          const refreshed = await supabase.auth.refreshSession();
          if (refreshed.data.session) return send(false);
          await supabase.auth.signOut();
        }
        let payload: unknown = null;
        try { payload = await response.json(); } catch { payload = null; }
        if (!response.ok) {
          const error = (payload as { error?: ApiErrorShape } | null)?.error ?? { code: 'UPLOAD_ERROR', message: 'The upload could not be completed.' };
          throw new ApiError(response.status, error);
        }
        return payload as ScanResponse;
      };
      return send(true);
    },
  };
}

export function getApiClient(): ApiClient {
  return createApiClient(getSupabaseClient());
}
