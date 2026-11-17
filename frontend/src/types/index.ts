export type ScreenId =
  | 'dashboard'
  | 'scan'
  | 'identification'
  | 'estimate'
  | 'inventory'
  | 'saved-scans'
  | 'listing-generator'
  | 'price-guides'
  | 'fee-calculator'
  | 'analytics'
  | 'settings';

export type AuthPageId = 'login' | 'register' | 'forgot-password' | 'reset-password';

export type AnalysisStage = 0 | 1 | 2 | 3;

export interface DemoImage {
  id: string;
  name: string;
  src?: string;
  isDemo?: boolean;
}

export interface IdentificationFields {
  name: string;
  brand: string;
  model: string;
  category: string;
  condition: string;
  attributes: string;
}

export interface AppState {
  screen: ScreenId;
  authPage: AuthPageId | null;
  authStatus: 'loading' | 'authenticated' | 'unauthenticated' | 'error';
  authError: string;
  fieldErrors: Record<string, string>;
  user: { id: string; email?: string } | null;
  profile: import('../services/supabase').Profile | null;
  authLoading: boolean;
  authSuccess: string;
  settingsSaving: boolean;
  passwordSaving: boolean;
  dashboardLoading: boolean;
  dashboardData?: import('../pages/dashboard').DashboardView;
  selectedImages: DemoImage[];
  analysisStage: AnalysisStage;
  uploadError: string;
  toast: string;
  currency: 'USD' | 'EUR' | 'GBP';
  identification: IdentificationFields;
}
