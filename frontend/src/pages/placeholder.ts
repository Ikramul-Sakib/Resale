import { renderPageHeader } from '../components/page-header';
import type { ScreenId } from '../types';

const labels: Record<Exclude<ScreenId, 'dashboard' | 'scan' | 'identification' | 'estimate'>, string> = {
  inventory: 'My Inventory',
  'saved-scans': 'Saved Scans',
  'listing-generator': 'Listing Generator',
  'price-guides': 'Price Guides',
  'fee-calculator': 'Fee Calculator',
  analytics: 'Analytics',
  settings: 'Settings',
};

export function renderPlaceholderPage(screen: Exclude<ScreenId, 'dashboard' | 'scan' | 'identification' | 'estimate'>, demoMode = false): string {
  return `
    ${renderPageHeader(labels[screen], 'This area will be connected in a later ResaleIQ phase.', { demoPill: demoMode })}
    <article class="card phase-card">
      <i data-lucide="construction" aria-hidden="true"></i>
      <h2>Frontend foundation ready</h2>
      <p>Navigation is wired, but this workspace is intentionally limited to the four approved Phase 2 screens.</p>
      <button class="button button-primary" type="button" data-action="dashboard">Back to Dashboard</button>
    </article>
  `;
}
