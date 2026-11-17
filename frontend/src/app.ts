import { createIcons, icons } from 'lucide';
import { renderLayout } from './components/layout';
import { renderDashboardPage, type DashboardView } from './pages/dashboard';
import { renderEstimatePage } from './pages/estimate';
import { renderIdentificationPage } from './pages/identification';
import { renderPlaceholderPage } from './pages/placeholder';
import { renderScanPage } from './pages/scan';
import { renderSettingsPage } from './pages/settings';
import { renderListingGeneratorPage } from './pages/listing-generator';
import { renderAuthLoadingPage, renderForgotPasswordPage, renderLoginPage, renderRegisterPage, renderResetPasswordPage } from './pages/auth';
import { consumeReturnPath, guardRoute, isPublicPath, navigate, normalizePath, rememberReturnPath, type AppPath } from './router';
import { ApiError, getApiClient } from './services/api';
import { getAuthService, type AuthContext, type AuthService, type RegisterInput } from './services/supabase';
import { forgotPasswordSchema, loginSchema, profileSchema, registerSchema, resetPasswordSchema } from './services/authValidation';
import type { AppState, AuthPageId, DemoImage, ScreenId } from './types';

const DEMO_MODE = String(import.meta.env.VITE_DEMO_MODE ?? '').toLowerCase() === 'true';
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const demoImages: DemoImage[] = [
  { id: 'demo-1', name: 'Sample photo 1', isDemo: true },
  { id: 'demo-2', name: 'Sample photo 2', isDemo: true },
  { id: 'demo-3', name: 'Sample photo 3', isDemo: true },
];

const state: AppState = {
  screen: 'dashboard', authPage: null, authStatus: 'loading', authError: '', fieldErrors: {}, user: null, profile: null,
  authLoading: false, authSuccess: '', settingsSaving: false, passwordSaving: false, dashboardLoading: false,
  selectedImages: DEMO_MODE ? demoImages : [], analysisStage: DEMO_MODE ? 1 : 0, uploadError: '', toast: '', currency: 'USD',
  scanStatus: 'idle', uploadProgress: 0, scanError: '', cameraError: '', itemSaving: false,
  identification: { name: 'Mechanical keyboard, 75% layout', brand: 'Keychron', model: 'K2', category: 'Computer accessories', condition: 'Good, light wear', attributes: 'Wireless, hot-swappable, RGB' },
  estimateLoading: false, estimateError: '', marketplaces: [], estimateMarketplaceId: '', suggestedPriceInput: '', manualFeePercentage: '', inventorySaving: false,
  listingLoading: false, listingError: '', listingDrafts: [], listingInventory: [], listingItemId: '', listingInventoryItemId: '', listingMarketplaceId: '', listingTone: 'neutral', listingNotes: '', listingPrice: '', listingDirty: false, listingSaving: false, listingCopyMessage: '', listingTitleMaxLength: 120, listingSaved: false,
};

let authService: AuthService | undefined;
let unsubscribeAuth: (() => void) | undefined;
let toastTimer: number | undefined;
let dashboardRequestInFlight = false;
let estimateRequestInFlight = false;
let listingRequestInFlight = false;

function getService(): AuthService { if (!authService) authService = getAuthService(); return authService; }
function isAuthenticated(): boolean { return state.authStatus === 'authenticated' && Boolean(state.user); }
function currentDisplayName(): string { return state.profile?.display_name || (state.user as any)?.user_metadata?.display_name || 'there'; }
function pathToScreen(path: AppPath): ScreenId { return path.slice(1) as ScreenId; }

function renderProtectedContent(): string {
  const demoSession = DEMO_MODE && !isAuthenticated();
  if (state.screen === 'dashboard') return renderDashboardPage({ demoMode: demoSession, displayName: currentDisplayName(), data: state.dashboardData, loading: state.dashboardLoading });
  if (state.screen === 'scan') return renderScanPage(state, demoSession);
  if (state.screen === 'identification') return demoSession ? renderIdentificationPage(state.identification) : state.scanResult?.identified_item ? renderIdentificationPage(state.scanResult.identified_item, state.scanResult.images?.[0]?.signed_url, state.scanResult.ai_mode, state.scanResult.identification_empty, state.itemSaving) : '<article class="card phase-card"><h2>No identification yet</h2><p>Upload a product photo to begin.</p></article>';
  if (state.screen === 'estimate') return renderEstimatePage(state, { demoMode: demoSession, loading: state.estimateLoading, error: state.estimateError, estimate: state.estimate?.estimate, item: state.scanResult?.identified_item, imageUrl: state.scanResult?.images?.[0]?.signed_url, aiMode: state.estimate?.ai_mode, fee: state.estimate?.fee, marketplaces: state.marketplaces, marketplaceId: state.estimateMarketplaceId, suggestedPrice: state.suggestedPriceInput, manualFeePercentage: state.manualFeePercentage, savingInventory: state.inventorySaving });
  if (state.screen === 'listing-generator') return renderListingGeneratorPage(state, { demoMode: demoSession, loading: state.listingLoading, error: state.listingError, generated: state.listingGenerated, aiMode: state.listingAiMode, drafts: state.listingDrafts, inventory: state.listingInventory, marketplaces: state.marketplaces, selectedItemId: state.listingItemId, selectedMarketplaceId: state.listingMarketplaceId, tone: state.listingTone, notes: state.listingNotes, price: state.listingPrice, dirty: state.listingDirty, saving: state.listingSaving, copyMessage: state.listingCopyMessage, titleMaxLength: state.listingTitleMaxLength, inventoryItemStatus: state.listingInventory.find((item) => item.id === state.listingInventoryItemId)?.status, saved: state.listingSaved });
  if (state.screen === 'settings' && isAuthenticated()) return renderSettingsPage({ email: state.user?.email ?? '', profile: state.profile, saving: state.settingsSaving, passwordSaving: state.passwordSaving, message: state.authSuccess, error: state.authError });
  return renderPlaceholderPage(state.screen as Exclude<ScreenId, 'dashboard' | 'scan' | 'identification' | 'estimate'>, demoSession);
}

function renderPublicPage(): string {
  const options = { path: `/${state.authPage}` as AuthPageId, error: state.authError, success: state.authSuccess, loading: state.authLoading, fieldErrors: state.fieldErrors };
  if (state.authPage === 'register') return renderRegisterPage(options);
  if (state.authPage === 'forgot-password') return renderForgotPasswordPage(options);
  if (state.authPage === 'reset-password') return renderResetPasswordPage(options);
  return renderLoginPage(options);
}

function render(): void {
  const root = document.querySelector<HTMLDivElement>('#app');
  if (!root) throw new Error('App root not found');
  if (state.authStatus === 'loading') { root.innerHTML = renderAuthLoadingPage(); return; }
  const rawPath = normalizePath(window.location.pathname);
  const guarded = guardRoute(rawPath, isAuthenticated(), DEMO_MODE && !isAuthenticated());
  if (guarded.redirectFrom) { rememberReturnPath(guarded.redirectFrom); navigate('/login'); return; }
  if (guarded.path !== rawPath) window.history.replaceState({}, '', guarded.path);
  if (isPublicPath(guarded.path)) {
    state.authPage = guarded.path.slice(1) as AuthPageId;
    root.innerHTML = renderPublicPage(); bindEvents(); return;
  }
  state.authPage = null; state.screen = pathToScreen(guarded.path as AppPath);
  root.innerHTML = renderLayout({ activeScreen: state.screen, content: renderProtectedContent(), toast: state.toast, demoMode: DEMO_MODE && !isAuthenticated(), displayName: DEMO_MODE && !isAuthenticated() ? 'Alex Rivera' : currentDisplayName(), email: state.user?.email ?? 'Demo workspace' });
  createIcons({ icons }); bindEvents();
}

function showToast(message: string): void {
  state.toast = message; window.clearTimeout(toastTimer); render();
  toastTimer = window.setTimeout(() => { state.toast = ''; render(); }, 3200);
}

async function loadMarketplaces(): Promise<void> {
  try { state.marketplaces = (await getApiClient().get<{ data: import('./services/api').Marketplace[] }>('/marketplaces')).data; } catch { state.marketplaces = []; }
}

async function loadListingData(): Promise<void> {
  if (!isAuthenticated() || state.screen !== 'listing-generator' || listingRequestInFlight) return;
  listingRequestInFlight = true;
  try {
    const [marketplaces, inventory, drafts] = await Promise.all([
      getApiClient().get<{ data: import('./services/api').Marketplace[] }>('/marketplaces'),
      getApiClient().get<{ data: import('./services/api').InventorySummary[] }>('/inventory?page=1&limit=100'),
      getApiClient().get<{ data: import('./services/api').ListingDraft[] }>('/listings?page=1&limit=50'),
    ]);
    state.marketplaces = marketplaces.data; state.listingInventory = inventory.data; state.listingDrafts = drafts.data;
    if (!state.listingMarketplaceId && state.marketplaces[0]) state.listingMarketplaceId = state.marketplaces[0].id;
    if (!state.listingItemId && state.listingInventory[0]) state.listingItemId = state.listingInventory[0].id;
    const marketplace = state.marketplaces.find((candidate) => candidate.id === state.listingMarketplaceId);
    state.listingTitleMaxLength = marketplace?.title_max_length ?? 120;
  } catch (error) { state.listingError = error instanceof ApiError ? error.message : 'Listing data could not be loaded.'; }
  finally { listingRequestInFlight = false; render(); }
}

function updateListingGeneratedFromFields(): void {
  if (!state.listingGenerated) return;
  const field = (name: string) => document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-listing-${name}]`)?.value ?? '';
  state.listingGenerated = { ...state.listingGenerated, title: field('title'), description: field('description'), condition_description: field('condition'), selling_points: field('points').split('\n').map((value) => value.trim()).filter(Boolean), keywords: field('keywords').split(',').map((value) => value.trim()).filter(Boolean) };
  state.listingDirty = true;
}

async function generateListing(): Promise<void> {
  if (!state.listingItemId || !state.listingMarketplaceId) { state.listingError = 'Choose an item and marketplace first.'; render(); return; }
  if (state.listingGenerated && state.listingDirty && !window.confirm('Regenerate and overwrite your unsaved listing edits?')) return;
  state.listingLoading = true; state.listingError = ''; state.listingCopyMessage = ''; render();
  try {
    const result = await getApiClient().post<import('./services/api').ListingGenerationResponse>('/listings/generate', { item_id: state.listingItemId, marketplace_id: state.listingMarketplaceId, currency: state.currency, tone: state.listingTone, notes: state.listingNotes || null, asking_price: state.listingPrice ? Number(state.listingPrice) : null });
    state.listingGenerated = result.generated; state.listingAiMode = result.ai_mode; state.listingItemId = result.item_id; state.listingInventoryItemId = result.inventory_item_id ?? ''; state.listingPrice = result.generated.suggested_price == null ? '' : String(result.generated.suggested_price); state.listingTitleMaxLength = result.marketplace.title_max_length ?? 120; state.listingDirty = false; state.listingSaved = false;
  } catch (error) { state.listingError = error instanceof ApiError ? error.message : 'The listing draft could not be generated.'; }
  finally { state.listingLoading = false; render(); }
}

async function copyListing(kind: 'title' | 'description' | 'all'): Promise<void> {
  if (!state.listingGenerated) return;
  const generated = state.listingGenerated;
  const text = kind === 'title' ? generated.title : kind === 'description' ? generated.description : `${generated.title}\n\n${generated.description}\n\nCondition: ${generated.condition_description}\n\nSelling points:\n${generated.selling_points.map((point) => `- ${point}`).join('\n')}\n\nKeywords: ${generated.keywords.join(', ')}`;
  try {
    const fallbackCopy = () => {
      const textarea = document.createElement('textarea'); textarea.value = text; textarea.style.position = 'fixed'; textarea.style.opacity = '0'; document.body.appendChild(textarea); textarea.select(); if (!document.execCommand('copy')) throw new Error('copy failed'); textarea.remove();
    };
    if (navigator.clipboard?.writeText) { try { await navigator.clipboard.writeText(text); } catch { fallbackCopy(); } } else fallbackCopy();
    state.listingCopyMessage = kind; render(); window.setTimeout(() => { state.listingCopyMessage = ''; render(); }, 1800);
  } catch { state.toast = 'Copy is unavailable in this browser.'; render(); }
}

async function saveListing(): Promise<void> {
  if (!state.listingGenerated) return;
  updateListingGeneratedFromFields();
  const generated = state.listingGenerated;
  const title = generated.title.trim();
  if (!title || title.length > state.listingTitleMaxLength) { state.listingError = 'Fix the title length before saving.'; render(); return; }
  state.listingSaving = true; state.listingError = ''; render();
  try {
    const askingPrice = state.listingPrice ? Number(state.listingPrice) : generated.suggested_price;
    const draft = await getApiClient().post<import('./services/api').ListingDraft>('/listings', { inventory_item_id: state.listingInventoryItemId || null, identified_item_id: state.listingInventoryItemId ? null : (state.listingItemId || null), marketplace_id: state.listingMarketplaceId || null, title, description: generated.description, condition: generated.condition_description, asking_price: askingPrice, asking_currency: generated.currency, attributes: { selling_points: generated.selling_points, keywords: generated.keywords }, status: 'draft' });
    state.listingDrafts = [draft, ...state.listingDrafts.filter((candidate) => candidate.id !== draft.id)]; state.listingDirty = false; state.listingSaved = true; state.toast = 'Listing draft saved.';
  } catch (error) { state.listingError = error instanceof ApiError ? error.message : 'The listing draft could not be saved.'; }
  finally { state.listingSaving = false; render(); }
}

function openDraft(draftId: string): void {
  const draft = state.listingDrafts.find((candidate) => candidate.id === draftId); if (!draft) return;
  const attributes = draft.attributes ?? {};
  state.listingItemId = draft.identified_item_id ?? draft.inventory_item_id ?? ''; state.listingInventoryItemId = draft.inventory_item_id ?? ''; state.listingMarketplaceId = draft.marketplace_id ?? state.listingMarketplaceId; state.listingGenerated = { title: draft.title, description: draft.description ?? '', condition_description: draft.condition ?? 'Condition to be confirmed by the seller.', selling_points: Array.isArray(attributes.selling_points) ? attributes.selling_points.map(String) : [], keywords: Array.isArray(attributes.keywords) ? attributes.keywords.map(String) : [], suggested_price: draft.asking_price ?? null, currency: draft.asking_currency ?? state.currency }; state.listingPrice = draft.asking_price == null ? '' : String(draft.asking_price); state.listingDirty = false; state.listingSaved = true; state.listingError = ''; render();
}

async function markListingPosted(): Promise<void> {
  if (!state.listingInventoryItemId) return;
  if (!window.confirm('Only mark this item Listed if you posted it yourself on the marketplace.')) return;
  try { await getApiClient().patch(`/inventory/${state.listingInventoryItemId}`, { status: 'listed' }); state.listingInventory = state.listingInventory.map((item) => item.id === state.listingInventoryItemId ? { ...item, status: 'listed' } : item); showToast('Inventory item marked Listed.'); } catch (error) { state.listingError = error instanceof ApiError ? error.message : 'The inventory status could not be updated.'; render(); }
}

async function deleteDraft(draftId: string): Promise<void> {
  if (!window.confirm('Delete this draft? It will be archived and removed from this list.')) return;
  try { await getApiClient().request(`/listings/${draftId}`, { method: 'DELETE' }); state.listingDrafts = state.listingDrafts.filter((draft) => draft.id !== draftId); if (state.listingGenerated && state.listingDrafts.every((draft) => draft.id !== draftId)) state.toast = 'Listing draft deleted.'; render(); } catch (error) { state.listingError = error instanceof ApiError ? error.message : 'The listing draft could not be deleted.'; render(); }
}

async function loadEstimate(force = false): Promise<void> {
  const itemId = state.estimateItemId ?? state.scanResult?.identified_item?.id;
  if (!isAuthenticated() || !itemId || estimateRequestInFlight) return;
  estimateRequestInFlight = true; state.estimateLoading = true; state.estimateError = ''; render();
  try {
    const result = await getApiClient().post<import('./services/api').EstimateResponse>(`/items/${itemId}/estimate`, { currency: state.currency, marketplace_id: state.estimateMarketplaceId || null, force });
    state.estimateItemId = itemId; state.estimate = result; state.suggestedPriceInput = String(result.estimate.suggested_price ?? result.estimate.suggested_selling_price ?? result.estimate.typical); state.estimateError = '';
  } catch (error) { state.estimate = undefined; state.estimateError = error instanceof ApiError ? error.message : 'The estimate could not be loaded.'; }
  finally { estimateRequestInFlight = false; state.estimateLoading = false; render(); }
}

async function calculateFee(): Promise<void> {
  const marketplaceId = state.estimateMarketplaceId; const salePrice = Number(state.suggestedPriceInput);
  if (!marketplaceId || !Number.isFinite(salePrice) || salePrice <= 0 || !state.estimate) return;
  try {
    const body: Record<string, unknown> = { marketplace_id: marketplaceId, sale_price: salePrice, currency: state.currency };
    if (state.manualFeePercentage) body.manual_percentage = Number(state.manualFeePercentage);
    const fee = await getApiClient().post<{ status: string; fee_amount: number; rule?: unknown }>('/fees/calculate', body);
    state.estimate = { ...state.estimate, fee: { status: fee.status, fee_amount: fee.fee_amount, rule: fee.rule } };
  } catch (error) {
    if (error instanceof ApiError && error.error.code === 'FEE_RULE_UNAVAILABLE') state.estimate = { ...state.estimate, fee: { status: 'not_verified', fee_amount: 0 } };
  }
  render();
}

function setAuthContext(context: AuthContext | null): void {
  state.user = context?.user ? { id: context.user.id, email: context.user.email } : null;
  state.profile = context?.profile ?? null;
  state.authStatus = context ? 'authenticated' : 'unauthenticated';
  if (context?.profile?.default_currency) state.currency = context.profile.default_currency as AppState['currency'];
}
function setFormErrors(issues: Array<{ path: PropertyKey[]; message: string }>): void { state.fieldErrors = Object.fromEntries(issues.map((issue) => [String(issue.path[0] ?? 'form'), issue.message])); }
function clearFormState(): void { state.authError = ''; state.authSuccess = ''; state.fieldErrors = {}; }

async function handleAuthForm(form: HTMLFormElement, kind: string): Promise<void> {
  const values = Object.fromEntries(new FormData(form).entries()); clearFormState();
  const parsed = kind === 'login' ? loginSchema.safeParse(values) : kind === 'register' ? registerSchema.safeParse(values) : kind === 'forgot' ? forgotPasswordSchema.safeParse(values) : resetPasswordSchema.safeParse(values);
  if (!parsed.success) { setFormErrors(parsed.error.issues); render(); return; }
  state.authLoading = true; render();
  try {
    const service = getService();
    if (kind === 'login') {
      const data = parsed.data as { email: string; password: string };
      setAuthContext(await service.signIn(data.email, data.password)); navigate(consumeReturnPath());
    } else if (kind === 'register') {
      const data = parsed.data as RegisterInput;
      const result = await service.register(data);
      if (result.context) { setAuthContext(result.context); navigate(consumeReturnPath()); } else state.authSuccess = 'Account created. Check your email to confirm your address before signing in.';
    } else if (kind === 'forgot') {
      const data = parsed.data as { email: string };
      await service.requestPasswordReset(data.email); state.authSuccess = 'If an account exists for that email, a reset link is on its way.';
    } else {
      const data = parsed.data as { password: string; confirmPassword: string };
      await service.updatePassword(data.password); state.authSuccess = 'Your password has been updated. You can sign in now.'; navigate('/login');
    }
  } catch (error) { state.authError = friendlyAuthError(error, kind); }
  finally { state.authLoading = false; render(); }
}

function friendlyAuthError(error: unknown, kind: string): string {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (kind === 'login') return 'Email or password is incorrect.';
  if (kind === 'register' && message.includes('already')) return 'We could not create the account with those details. Try signing in or use another email.';
  if (kind === 'reset' && message.includes('session')) return 'This reset link is invalid or has expired. Request a new one.';
  return 'Something went wrong. Please try again.';
}

async function loadDashboard(): Promise<void> {
  if (!isAuthenticated() || dashboardRequestInFlight || state.screen !== 'dashboard') return;
  dashboardRequestInFlight = true; state.dashboardLoading = true; render();
  try {
    const api = getApiClient();
    const [analytics, scans] = await Promise.all([
      api.get<{ inventory: { owned: number; listed: number; sold: number; estimated_value: number }; sales: { net_earnings: number } }>('/analytics/dashboard'),
      api.get<{ data: Array<{ id: string; status: string; created_at: string }>; total: number }>('/scans?page=1&limit=3'),
    ]);
    const recentScans = scans.data.map((scan) => ({ label: `Scan ${scan.id.slice(0, 8)} · ${scan.status}`, time: new Date(scan.created_at).toLocaleDateString() }));
    state.dashboardData = { scannedItems: scans.total, inventoryValue: Number(analytics.inventory.estimated_value ?? 0), listedItems: analytics.inventory.listed, soldItems: analytics.inventory.sold, totalProfit: Number(analytics.sales.net_earnings ?? 0), recentScans, owned: analytics.inventory.owned, listed: analytics.inventory.listed, sold: analytics.inventory.sold, activity: [] };
  } catch (error) { if (!(error instanceof ApiError && error.status === 401)) state.authError = 'Your dashboard data could not be loaded. Please try again.'; }
  finally { dashboardRequestInFlight = false; state.dashboardLoading = false; render(); }
}

function addSelectedFiles(incoming: File[]): void {
  if (!incoming.length) return;
  const availableSlots = 6 - state.selectedImages.length; const accepted: DemoImage[] = []; const errors: string[] = [];
  incoming.slice(0, Math.max(0, availableSlots)).forEach((file, index) => { if (!ALLOWED_TYPES.has(file.type)) errors.push(`${file.name}: use JPG, PNG, or WebP.`); else if (file.size > MAX_FILE_SIZE) errors.push(`${file.name}: maximum size is 10 MB.`); else accepted.push({ id: `upload-${Date.now()}-${index}`, name: file.name, src: URL.createObjectURL(file), file }); });
  if (incoming.length > availableSlots) errors.push('You can select up to 6 images.'); state.selectedImages = [...state.selectedImages, ...accepted]; state.uploadError = errors.join(' '); render();
}
function addFiles(files: FileList | null): void {
  if (!files?.length) return;
  addSelectedFiles(Array.from(files));
}
function startAnalysis(): void {
  if (!isAuthenticated()) { showToast('Sign in to upload a real product photo.'); return; }
  const files = state.selectedImages.flatMap((image) => image.file ? [image.file] : []);
  if (!files.length) { state.uploadError = 'Choose at least one real image before starting analysis.'; render(); return; }
  state.scanStatus = 'uploading'; state.uploadProgress = 0; state.scanError = ''; state.analysisStage = 1; render();
  void getApiClient().uploadScan(files, 'upload', (progress) => { state.uploadProgress = progress; if (progress >= 100) state.scanStatus = 'identifying'; render(); }).then((result) => {
    state.scanResult = result; state.scanStatus = result.status === 'failed' ? 'failed' : 'completed'; state.analysisStage = result.status === 'completed' ? 3 : 0;
    if (result.status === 'completed') navigate('/identification'); else render();
  }).catch((error) => {
    state.scanStatus = 'failed'; state.analysisStage = 0; state.scanError = error instanceof ApiError ? error.message : 'The scan could not be completed.';
    const details = error instanceof ApiError && typeof error.error.details === 'object' && error.error.details !== null ? error.error.details as { scan_id?: string } : {};
    if (details.scan_id) state.scanResult = { id: details.scan_id, status: 'failed', source: 'upload', images: [], identified_item: null, ai_mode: 'real', identification_empty: true };
    render();
  });
}

async function openCamera(): Promise<void> {
  if (!navigator.mediaDevices?.getUserMedia) { state.cameraError = 'Camera access is unavailable. Choose an image from your device.'; render(); document.querySelector<HTMLInputElement>('[data-camera-input]')?.click(); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    const modal = document.createElement('div'); modal.className = 'camera-modal'; modal.innerHTML = '<div class="camera-dialog" role="dialog" aria-modal="true" aria-labelledby="camera-title"><h2 id="camera-title">Take a product photo</h2><video autoplay playsinline></video><div class="page-actions"><button class="button button-primary" type="button" data-camera-capture>Take photo</button><button class="button button-secondary" type="button" data-camera-cancel>Cancel</button></div></div>';
    document.body.appendChild(modal); const video = modal.querySelector('video'); if (video) video.srcObject = stream;
    const close = () => { stream.getTracks().forEach((track) => track.stop()); modal.remove(); };
    modal.querySelector('[data-camera-cancel]')?.addEventListener('click', close);
    modal.querySelector('[data-camera-capture]')?.addEventListener('click', () => { if (!video) return; const canvas = document.createElement('canvas'); canvas.width = video.videoWidth || 1280; canvas.height = video.videoHeight || 720; canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height); canvas.toBlob((blob) => { if (blob) addSelectedFiles([new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' })]); close(); }, 'image/jpeg', 0.9); });
  } catch {
    state.cameraError = 'Camera permission was denied or unavailable. Choose an image from your device instead.'; render(); document.querySelector<HTMLInputElement>('[data-camera-input]')?.click();
  }
}

function handleAction(action: string, element: HTMLElement): void {
  if (action === 'scan') { navigate('/scan'); return; } if (action === 'dashboard') { navigate('/dashboard'); return; }
  if (action === 'toggle-avatar-menu') { const menu = document.querySelector<HTMLElement>('[data-avatar-menu]'); const button = element as HTMLButtonElement; if (menu) { menu.hidden = !menu.hidden; button.setAttribute('aria-expanded', String(!menu.hidden)); } return; }
  if (action === 'logout') { if (!isAuthenticated()) { showToast('Demo mode has no active account session.'); return; } void getService().signOut().then(() => { setAuthContext(null); navigate('/login'); }); return; }
  if (action === 'open-upload') { document.querySelector<HTMLInputElement>('[data-file-input]')?.click(); return; } if (action === 'open-camera') { void openCamera(); return; }
  if (action === 'remove-image') { const image = state.selectedImages[Number(element.dataset.index)]; if (image?.src) URL.revokeObjectURL(image.src); state.selectedImages.splice(Number(element.dataset.index), 1); render(); return; } if (action === 'identify') { startAnalysis(); return; }
  if (action === 'save-identification') { void saveIdentification(); return; }
  if (action === 'retry-scan' && state.scanResult?.id) { state.scanStatus = 'identifying'; state.scanError = ''; render(); void getApiClient().post<import('./services/api').ScanResponse>(`/scans/${state.scanResult.id}/retry`).then((result) => { state.scanResult = result; state.scanStatus = 'completed'; navigate('/identification'); }).catch((error) => { state.scanStatus = 'failed'; state.scanError = error instanceof ApiError ? error.message : 'Retry failed.'; render(); }); return; }
  if (action === 'continue-estimate') { state.estimateItemId = state.scanResult?.identified_item?.id; navigate('/estimate'); void loadMarketplaces(); void loadEstimate(true); return; }
  if (action === 'retry-estimate') { void loadEstimate(true); return; }
  if (action === 'generate-listing') { if (state.screen === 'estimate') { if (DEMO_MODE && !isAuthenticated()) { showToast('Demo action: listing generation is not connected.'); return; } state.listingItemId = state.estimateItemId ?? state.scanResult?.identified_item?.id ?? ''; state.listingMarketplaceId = state.estimateMarketplaceId; state.listingPrice = state.suggestedPriceInput; state.listingInventoryItemId = ''; state.listingGenerated = undefined; state.listingDirty = false; state.listingSaved = false; navigate('/listing-generator'); void loadListingData(); return; } void generateListing(); return; }
  if (action === 'retry-listing') { void generateListing(); return; }
  if (action === 'copy-title' || action === 'copy-description' || action === 'copy-all') { void copyListing(action === 'copy-title' ? 'title' : action === 'copy-description' ? 'description' : 'all'); return; }
  if (action === 'save-listing') { void saveListing(); return; }
  if (action === 'mark-listed') { void markListingPosted(); return; }
  if (action === 'open-draft') { openDraft(element.dataset.draftId ?? ''); return; }
  if (action === 'delete-draft') { void deleteDraft(element.dataset.draftId ?? ''); return; }
  if (action === 'save-inventory') { if (DEMO_MODE && !isAuthenticated()) { showToast('Demo action: inventory saving is connected in a later phase.'); return; } void saveInventory(); }
}

function bindEvents(): void {
  document.querySelectorAll<HTMLElement>('[data-path]').forEach((element) => element.addEventListener('click', (event) => { event.preventDefault(); if (state.listingDirty && state.screen === 'listing-generator' && !window.confirm('You have unsaved listing edits. Leave this page?')) return; const path = element.dataset.path as AppPath | undefined; if (path) navigate(path); }));
  document.querySelectorAll<HTMLElement>('[data-action]').forEach((element) => element.addEventListener('click', () => handleAction(element.dataset.action ?? '', element)));
  document.querySelector<HTMLFormElement>('[data-auth-form]')?.addEventListener('submit', (event) => { event.preventDefault(); const form = event.currentTarget as HTMLFormElement; void handleAuthForm(form, form.dataset.authForm ?? ''); });
  document.querySelector<HTMLFormElement>('[data-settings-form]')?.addEventListener('submit', (event) => { event.preventDefault(); void saveSettings(event.currentTarget as HTMLFormElement); });
  document.querySelector<HTMLFormElement>('[data-password-form]')?.addEventListener('submit', (event) => { event.preventDefault(); void savePassword(event.currentTarget as HTMLFormElement); });
  document.querySelector<HTMLInputElement>('[data-file-input]')?.addEventListener('change', (event) => addFiles((event.currentTarget as HTMLInputElement).files)); document.querySelector<HTMLInputElement>('[data-camera-input]')?.addEventListener('change', (event) => addFiles((event.currentTarget as HTMLInputElement).files));
  const dropZone = document.querySelector<HTMLElement>('[data-drop-zone]'); dropZone?.addEventListener('dragover', (event) => { event.preventDefault(); dropZone.classList.add('is-dragging'); }); dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('is-dragging')); dropZone?.addEventListener('drop', (event) => { event.preventDefault(); dropZone.classList.remove('is-dragging'); addFiles((event as DragEvent).dataTransfer?.files ?? null); }); dropZone?.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); document.querySelector<HTMLInputElement>('[data-file-input]')?.click(); } });
  document.querySelector<HTMLInputElement>('[data-currency]')?.addEventListener('change', (event) => { state.currency = (event.currentTarget as HTMLSelectElement).value as AppState['currency']; render(); });
  document.querySelector<HTMLSelectElement>('[data-estimate-currency]')?.addEventListener('change', (event) => { state.currency = (event.currentTarget as HTMLSelectElement).value as AppState['currency']; state.estimate = undefined; void loadEstimate(true); });
  document.querySelector<HTMLSelectElement>('[data-estimate-marketplace]')?.addEventListener('change', (event) => { state.estimateMarketplaceId = (event.currentTarget as HTMLSelectElement).value; void calculateFee(); });
  document.querySelector<HTMLInputElement>('[data-estimate-suggested]')?.addEventListener('change', (event) => { state.suggestedPriceInput = (event.currentTarget as HTMLInputElement).value; void calculateFee(); });
  document.querySelector<HTMLInputElement>('[data-manual-fee]')?.addEventListener('change', (event) => { state.manualFeePercentage = (event.currentTarget as HTMLInputElement).value; void calculateFee(); });
  document.querySelector<HTMLSelectElement>('[data-listing-item]')?.addEventListener('change', (event) => { if (state.listingDirty && !window.confirm('Change the item and discard your unsaved edits?')) { render(); return; } state.listingItemId = (event.currentTarget as HTMLSelectElement).value; state.listingInventoryItemId = state.listingInventory.some((item) => item.id === state.listingItemId) ? state.listingItemId : ''; state.listingGenerated = undefined; state.listingSaved = false; state.listingDirty = false; render(); });
  document.querySelector<HTMLSelectElement>('[data-listing-marketplace]')?.addEventListener('change', (event) => { state.listingMarketplaceId = (event.currentTarget as HTMLSelectElement).value; const marketplace = state.marketplaces.find((candidate) => candidate.id === state.listingMarketplaceId); state.listingTitleMaxLength = marketplace?.title_max_length ?? 120; state.listingDirty = true; render(); });
  document.querySelector<HTMLSelectElement>('[data-listing-tone]')?.addEventListener('change', (event) => { state.listingTone = (event.currentTarget as HTMLSelectElement).value as AppState['listingTone']; state.listingDirty = true; });
  document.querySelector<HTMLTextAreaElement>('[data-listing-notes]')?.addEventListener('input', (event) => { state.listingNotes = (event.currentTarget as HTMLTextAreaElement).value; const count = document.querySelector('[data-notes-count]'); if (count) count.textContent = String(state.listingNotes.length); state.listingDirty = true; });
  document.querySelector<HTMLInputElement>('[data-listing-price]')?.addEventListener('input', (event) => { state.listingPrice = (event.currentTarget as HTMLInputElement).value; state.listingDirty = true; });
  document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-listing-title], [data-listing-description], [data-listing-condition], [data-listing-points], [data-listing-keywords]').forEach((input) => input.addEventListener('input', () => { updateListingGeneratedFromFields(); const title = document.querySelector<HTMLInputElement>('[data-listing-title]'); const titleCount = document.querySelector('[data-title-count]'); const titleWarning = document.querySelector<HTMLElement>('[data-title-warning]'); if (titleCount && title) titleCount.textContent = String(title.value.length); if (titleWarning && title) titleWarning.hidden = title.value.length <= state.listingTitleMaxLength; const description = document.querySelector<HTMLTextAreaElement>('[data-listing-description]'); const descriptionCount = document.querySelector('[data-description-count]'); if (descriptionCount && description) descriptionCount.textContent = String(description.value.length); }));
  document.querySelectorAll<HTMLInputElement>('[data-field]').forEach((input) => input.addEventListener('input', () => { state.identification[input.dataset.field as keyof AppState['identification']] = input.value; })); document.querySelector<HTMLFormElement>('[data-search-form]')?.addEventListener('submit', (event) => { event.preventDefault(); showToast(DEMO_MODE && !isAuthenticated() ? 'Demo search is not connected to live data.' : 'Search is not connected yet.'); });
}

async function saveSettings(form: HTMLFormElement): Promise<void> { const parsed = profileSchema.safeParse(Object.fromEntries(new FormData(form).entries())); clearFormState(); if (!parsed.success) { setFormErrors(parsed.error.issues); state.authError = 'Check the profile fields.'; render(); return; } state.settingsSaving = true; render(); try { state.profile = await getService().updateProfile({ display_name: parsed.data.displayName, default_currency: parsed.data.currency }); state.authSuccess = 'Profile saved.'; } catch { state.authError = 'Unable to save your profile right now.'; } finally { state.settingsSaving = false; render(); } }
async function savePassword(form: HTMLFormElement): Promise<void> { const parsed = resetPasswordSchema.safeParse(Object.fromEntries(new FormData(form).entries())); clearFormState(); if (!parsed.success) { setFormErrors(parsed.error.issues); state.authError = 'Check the password fields.'; render(); return; } state.passwordSaving = true; render(); try { await getService().changePassword(parsed.data.password); state.authSuccess = 'Password updated.'; form.reset(); } catch { state.authError = 'Unable to change your password right now.'; } finally { state.passwordSaving = false; render(); } }

async function saveIdentification(): Promise<void> {
  const itemId = state.scanResult?.identified_item?.id;
  if (!itemId || !state.scanResult) return;
  const value = (field: string) => document.querySelector<HTMLInputElement>(`[data-field="${field}"]`)?.value.trim() ?? '';
  state.itemSaving = true; render();
  try {
    const item = await getApiClient().patch<import('./services/api').IdentifiedItem>(`/items/${itemId}`, {
      name: value('name') || 'Unknown item', brand_text: value('brand') || null, model: value('model') || null,
      category_text: value('category') || null, product_type: value('productType') || null, condition: value('condition') || null,
      key_attributes: value('attributes') ? { text: value('attributes') } : {}, review_status: 'reviewed',
    });
    state.scanResult = { ...state.scanResult, identified_item: item };
    state.toast = 'Identification changes saved.';
  } catch (error) { state.scanError = error instanceof ApiError ? error.message : 'Identification changes could not be saved.'; }
  finally { state.itemSaving = false; render(); }
}

async function saveInventory(): Promise<void> {
  const item = state.scanResult?.identified_item; const estimate = state.estimate?.estimate;
  if (!item || !estimate) return;
  state.inventorySaving = true; render();
  try { await getApiClient().post('/inventory', { identified_item_id: item.id, price_estimate_id: estimate.id, item_name: item.name, condition: item.condition ?? null, status: 'owned', estimated_value: estimate.typical, estimated_value_currency: estimate.currency, attributes: item.key_attributes ?? {} }); showToast('Saved to inventory.'); }
  catch (error) { showToast(error instanceof ApiError ? error.message : 'Could not save this item.'); }
  finally { state.inventorySaving = false; render(); }
}

async function initialize(): Promise<void> {
  window.addEventListener('popstate', () => { clearFormState(); render(); void loadDashboard(); if (state.screen === 'estimate') { void loadMarketplaces(); void loadEstimate(); } if (state.screen === 'listing-generator') void loadListingData(); });
  if (DEMO_MODE) { try { authService = getAuthService(); } catch { /* Demo mode can run without Supabase variables. */ } state.authStatus = 'unauthenticated'; render(); return; }
  try { const service = getService(); setAuthContext(await service.getContext()); unsubscribeAuth = service.onAuthStateChange((context) => { setAuthContext(context); render(); void loadDashboard(); }); } catch (error) { state.authStatus = 'error'; state.authError = error instanceof Error ? error.message : 'Authentication is not configured.'; }
  render(); void loadDashboard(); if (state.screen === 'estimate') { void loadMarketplaces(); void loadEstimate(); } if (state.screen === 'listing-generator') void loadListingData();
}

export function startApp(): void { void initialize(); }
export function stopAuthListener(): void { unsubscribeAuth?.(); }
