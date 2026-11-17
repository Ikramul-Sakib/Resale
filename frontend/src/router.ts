export type PublicPath = '/login' | '/register' | '/forgot-password' | '/reset-password';
export type ProtectedPath = '/dashboard' | '/scan' | '/inventory' | '/saved-scans' | '/listing-generator' | '/price-guides' | '/fee-calculator' | '/analytics' | '/settings' | '/identification' | '/estimate';
export type AppPath = PublicPath | ProtectedPath;

export interface RouteGuardResult {
  path: AppPath;
  redirectFrom?: string;
}

const publicPaths = new Set<PublicPath>(['/login', '/register', '/forgot-password', '/reset-password']);

export function normalizePath(pathname: string): AppPath | string {
  const path = pathname.replace(/\/$/, '') || '/dashboard';
  if (path === '/') return '/dashboard';
  return path;
}

export function isPublicPath(path: string): path is PublicPath {
  return publicPaths.has(path as PublicPath);
}

export function guardRoute(pathname: string, authenticated: boolean, demoMode: boolean): RouteGuardResult {
  const path = normalizePath(pathname);
  if (isPublicPath(path)) {
    if (authenticated && (path === '/login' || path === '/register')) return { path: '/dashboard' };
    return { path };
  }
  if (authenticated || demoMode) return { path: (path as ProtectedPath) || '/dashboard' };
  return { path: '/login', redirectFrom: path };
}

export function navigate(path: AppPath): void {
  if (window.location.pathname !== path) window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function rememberReturnPath(path: string): void {
  if (path && path !== '/login') sessionStorage.setItem('resaleiq.return_to', path);
}

export function consumeReturnPath(): AppPath {
  const path = sessionStorage.getItem('resaleiq.return_to');
  sessionStorage.removeItem('resaleiq.return_to');
  return (path as AppPath | null) ?? '/dashboard';
}
