import { describe, expect, it } from 'vitest';
import { renderInventoryPage } from '../src/pages/inventory';
import { renderSavedScansPage } from '../src/pages/saved-scans';

describe('inventory and scan pagination', () => {
  it('offers navigation beyond the first fifty inventory items', () => {
    const html = renderInventoryPage({ items: [], page: 1, totalPages: 2 });
    expect(html).toContain('data-action="inventory-next" >Next');
    expect(html).toContain('data-action="inventory-prev" disabled');
  });
  it('allows returning from a final scan page', () => {
    const html = renderSavedScansPage({ scans: [], page: 2, totalPages: 2 });
    expect(html).toContain('data-action="scans-prev" >Previous');
    expect(html).toContain('data-action="scans-next" disabled');
  });
});
