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
  selectedImages: DemoImage[];
  analysisStage: AnalysisStage;
  uploadError: string;
  toast: string;
  currency: 'USD' | 'EUR' | 'GBP';
  identification: IdentificationFields;
}
