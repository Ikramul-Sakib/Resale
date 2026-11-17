import { createIcons, icons } from 'lucide';
import { renderLayout } from './components/layout';
import { renderDashboardPage, type DashboardView } from './pages/dashboard';
import { renderEstimatePage } from './pages/estimate';
import { renderIdentificationPage } from './pages/identification';
import { renderPlaceholderPage } from './pages/placeholder';
import { renderScanPage } from './pages/scan';
import { renderSettingsPage } from './pages/settings';
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
  identification: { name: 'Mechanical keyboard, 75% layout', brand: 'Keychron', model: 'K2', category: 'Computer accessories', condition: 'Good, light wear', attributes: 'Wireless, hot-swappable, RGB' },
};

let authService: AuthService | undefined;
let unsubscribeAuth: (() => void) | undefined;
let toastTimer: number | undefined;
let dashboardRequestInFlight = false;

function getService(): AuthService { if (!authService) authService = getAuthService(); return authService; }
function isAuthenticated(): boolean { return state.authStatus === 'authenticated' && Boolean(state.user); }
function currentDisplayName(): string { return state.profile?.display_name || (state.user as any)?.user_metadata?.display_name || 'there'; }
function pathToScreen(path: AppPath): ScreenId { return path.slice(1) as ScreenId; }

function renderProtectedContent(): string {
  const demoSession = DEMO_MODE && !isAuthenticated();
  if (state.screen === 'dashboard') return renderDashboardPage({ demoMode: demoSession, displayName: currentDisplayName(), data: state.dashboardData, loading: state.dashboardLoading });
  if (state.screen === 'scan') return renderScanPage(state, demoSession);
  if (state.screen === 'identification') return demoSession ? renderIdentificationPage(state.identification) : '<article class="card phase-card"><h2>Identification is not available yet</h2><p>The Gemini identification pipeline will be connected in a later phase.</p></article>';
  if (state.screen === 'estimate') return demoSession ? renderEstimatePage(state) : '<article class="card phase-card"><h2>No estimate yet</h2><p>AI price estimation is not available until the identification pipeline is connected.</p></article>';
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

function addFiles(files: FileList | null): void {
  if (!files?.length) return;
  const incoming = Array.from(files); const availableSlots = 6 - state.selectedImages.length; const accepted: DemoImage[] = []; const errors: string[] = [];
  incoming.slice(0, Math.max(0, availableSlots)).forEach((file, index) => { if (!ALLOWED_TYPES.has(file.type)) errors.push(`${file.name}: use JPG, PNG, or WebP.`); else if (file.size > MAX_FILE_SIZE) errors.push(`${file.name}: maximum size is 10 MB.`); else accepted.push({ id: `upload-${Date.now()}-${index}`, name: file.name, src: URL.createObjectURL(file) }); });
  if (incoming.length > availableSlots) errors.push('You can select up to 6 images.'); state.selectedImages = [...state.selectedImages, ...accepted]; state.uploadError = errors.join(' '); render();
}
function startAnalysis(): void {
  if (!DEMO_MODE || isAuthenticated()) { void getApiClient().post('/scans', {}).catch((error) => showToast(error instanceof ApiError ? error.message : 'The upload pipeline is not available yet.')); return; }
  state.analysisStage = 2; render(); window.setTimeout(() => { state.analysisStage = 3; render(); }, 900); window.setTimeout(() => { state.analysisStage = 1; navigate('/identification'); }, 1800);
}

function handleAction(action: string, element: HTMLElement): void {
  if (action === 'scan') { navigate('/scan'); return; } if (action === 'dashboard') { navigate('/dashboard'); return; }
  if (action === 'toggle-avatar-menu') { const menu = document.querySelector<HTMLElement>('[data-avatar-menu]'); const button = element as HTMLButtonElement; if (menu) { menu.hidden = !menu.hidden; button.setAttribute('aria-expanded', String(!menu.hidden)); } return; }
  if (action === 'logout') { if (!isAuthenticated()) { showToast('Demo mode has no active account session.'); return; } void getService().signOut().then(() => { setAuthContext(null); navigate('/login'); }); return; }
  if (action === 'open-upload') { document.querySelector<HTMLInputElement>('[data-file-input]')?.click(); return; } if (action === 'open-camera') { document.querySelector<HTMLInputElement>('[data-camera-input]')?.click(); return; }
  if (action === 'remove-image') { state.selectedImages.splice(Number(element.dataset.index), 1); render(); return; } if (action === 'identify') { startAnalysis(); return; }
  if (action === 'continue-estimate') { navigate('/estimate'); return; } if (action === 'generate-listing') { showToast('Demo action complete: listing generation will be connected in a later phase.'); return; } if (action === 'save-inventory') showToast('Demo action complete: inventory saving will be connected in a later phase.');
}

function bindEvents(): void {
  document.querySelectorAll<HTMLElement>('[data-path]').forEach((element) => element.addEventListener('click', (event) => { event.preventDefault(); const path = element.dataset.path as AppPath | undefined; if (path) navigate(path); }));
  document.querySelectorAll<HTMLElement>('[data-action]').forEach((element) => element.addEventListener('click', () => handleAction(element.dataset.action ?? '', element)));
  document.querySelector<HTMLFormElement>('[data-auth-form]')?.addEventListener('submit', (event) => { event.preventDefault(); const form = event.currentTarget as HTMLFormElement; void handleAuthForm(form, form.dataset.authForm ?? ''); });
  document.querySelector<HTMLFormElement>('[data-settings-form]')?.addEventListener('submit', (event) => { event.preventDefault(); void saveSettings(event.currentTarget as HTMLFormElement); });
  document.querySelector<HTMLFormElement>('[data-password-form]')?.addEventListener('submit', (event) => { event.preventDefault(); void savePassword(event.currentTarget as HTMLFormElement); });
  document.querySelector<HTMLInputElement>('[data-file-input]')?.addEventListener('change', (event) => addFiles((event.currentTarget as HTMLInputElement).files)); document.querySelector<HTMLInputElement>('[data-camera-input]')?.addEventListener('change', (event) => addFiles((event.currentTarget as HTMLInputElement).files));
  const dropZone = document.querySelector<HTMLElement>('[data-drop-zone]'); dropZone?.addEventListener('dragover', (event) => { event.preventDefault(); dropZone.classList.add('is-dragging'); }); dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('is-dragging')); dropZone?.addEventListener('drop', (event) => { event.preventDefault(); dropZone.classList.remove('is-dragging'); addFiles((event as DragEvent).dataTransfer?.files ?? null); }); dropZone?.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); document.querySelector<HTMLInputElement>('[data-file-input]')?.click(); } });
  document.querySelector<HTMLInputElement>('[data-currency]')?.addEventListener('change', (event) => { state.currency = (event.currentTarget as HTMLSelectElement).value as AppState['currency']; render(); }); document.querySelectorAll<HTMLInputElement>('[data-field]').forEach((input) => input.addEventListener('input', () => { state.identification[input.dataset.field as keyof AppState['identification']] = input.value; })); document.querySelector<HTMLFormElement>('[data-search-form]')?.addEventListener('submit', (event) => { event.preventDefault(); showToast(DEMO_MODE && !isAuthenticated() ? 'Demo search is not connected to live data.' : 'Search is not connected yet.'); });
}

async function saveSettings(form: HTMLFormElement): Promise<void> { const parsed = profileSchema.safeParse(Object.fromEntries(new FormData(form).entries())); clearFormState(); if (!parsed.success) { setFormErrors(parsed.error.issues); state.authError = 'Check the profile fields.'; render(); return; } state.settingsSaving = true; render(); try { state.profile = await getService().updateProfile({ display_name: parsed.data.displayName, default_currency: parsed.data.currency }); state.authSuccess = 'Profile saved.'; } catch { state.authError = 'Unable to save your profile right now.'; } finally { state.settingsSaving = false; render(); } }
async function savePassword(form: HTMLFormElement): Promise<void> { const parsed = resetPasswordSchema.safeParse(Object.fromEntries(new FormData(form).entries())); clearFormState(); if (!parsed.success) { setFormErrors(parsed.error.issues); state.authError = 'Check the password fields.'; render(); return; } state.passwordSaving = true; render(); try { await getService().changePassword(parsed.data.password); state.authSuccess = 'Password updated.'; form.reset(); } catch { state.authError = 'Unable to change your password right now.'; } finally { state.passwordSaving = false; render(); } }

async function initialize(): Promise<void> {
  window.addEventListener('popstate', () => { clearFormState(); render(); void loadDashboard(); });
  if (DEMO_MODE) { try { authService = getAuthService(); } catch { /* Demo mode can run without Supabase variables. */ } state.authStatus = 'unauthenticated'; render(); return; }
  try { const service = getService(); setAuthContext(await service.getContext()); unsubscribeAuth = service.onAuthStateChange((context) => { setAuthContext(context); render(); void loadDashboard(); }); } catch (error) { state.authStatus = 'error'; state.authError = error instanceof Error ? error.message : 'Authentication is not configured.'; }
  render(); void loadDashboard();
}

export function startApp(): void { void initialize(); }
export function stopAuthListener(): void { unsubscribeAuth?.(); }
