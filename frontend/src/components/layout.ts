import type { ScreenId } from '../types';
import { escapeHtml } from '../utils/html';

interface LayoutProps {
  activeScreen: ScreenId;
  content: string;
  toast: string;
  demoMode: boolean;
  displayName: string;
  email: string;
}

const navItems: Array<{ id: ScreenId; label: string; icon: string }> = [
  { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard' },
  { id: 'scan', label: 'Scan Product', icon: 'scan-line' },
  { id: 'inventory', label: 'My Inventory', icon: 'package' },
  { id: 'saved-scans', label: 'Saved Scans', icon: 'bookmark' },
  { id: 'listing-generator', label: 'Listing Generator', icon: 'file-pen-line' },
  { id: 'price-guides', label: 'Price Guides', icon: 'book-open' },
  { id: 'fee-calculator', label: 'Fee Calculator', icon: 'calculator' },
  { id: 'analytics', label: 'Analytics', icon: 'chart-no-axes-combined' },
  { id: 'settings', label: 'Settings', icon: 'settings-2' },
];

function renderNavItem(item: (typeof navItems)[number], activeScreen: ScreenId): string {
  const active = activeScreen === item.id;
  return `
    <button class="nav-item${active ? ' is-active' : ''}" type="button" data-path="/${item.id}" ${
      active ? 'aria-current="page"' : ''
    }>
      <i data-lucide="${item.icon}" aria-hidden="true"></i>
      <span>${item.label}</span>
    </button>
  `;
}

export function renderLayout({ activeScreen, content, toast, demoMode, displayName, email }: LayoutProps): string {
  const safeName = escapeHtml(displayName || 'Account');
  const safeEmail = escapeHtml(email);
  const initials = displayName.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'U';
  return `
    <div class="app-shell">
      <aside class="sidebar" aria-label="Primary navigation">
        <div class="brand-lockup">
          <span class="brand-mark" aria-hidden="true"></span>
          <span>ResaleIQ</span>
        </div>
        <nav class="primary-nav">
          ${navItems.map((item) => renderNavItem(item, activeScreen)).join('')}
        </nav>
      </aside>

      <div class="app-main">
        <header class="topbar">
          <form class="search-form" data-search-form role="search">
            <i data-lucide="search" aria-hidden="true"></i>
            <input
              type="search"
              name="search"
              placeholder="Search scans, items, listings"
              aria-label="Search scans, items, listings"
            />
          </form>
          <div class="topbar-actions">
            ${demoMode ? '<span class="demo-pill" title="This frontend is running with mock data">Demo data</span>' : ''}
            <div class="avatar-menu-wrap">
              <button class="avatar avatar-button" type="button" data-action="toggle-avatar-menu" aria-label="Open account menu" aria-expanded="false">${initials}</button>
              <div class="avatar-menu" data-avatar-menu hidden>
                <strong>${safeName}</strong>
                <span>${safeEmail}</span>
                <a href="/settings" data-path="/settings">Settings</a>
                <button type="button" data-action="logout">Log out</button>
              </div>
            </div>
          </div>
        </header>
        <main class="page-content">${content}</main>
      </div>
    </div>
    <div class="toast${toast ? ' is-visible' : ''}" role="status" aria-live="polite">${escapeHtml(toast)}</div>
  `;
}
