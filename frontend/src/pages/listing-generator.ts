import { renderPageHeader } from '../components/page-header';
import type { AppState } from '../types';
import { escapeHtml } from '../utils/html';
import type { GeneratedListing, InventorySummary, ListingDraft, Marketplace } from '../services/api';

export interface ListingPageOptions {
  demoMode: boolean;
  loading: boolean;
  error: string;
  generated?: GeneratedListing;
  aiMode?: 'real' | 'mock';
  drafts: ListingDraft[];
  inventory: InventorySummary[];
  marketplaces: Marketplace[];
  selectedItemId: string;
  selectedMarketplaceId: string;
  tone: string;
  notes: string;
  price: string;
  dirty: boolean;
  saving: boolean;
  copyMessage: string;
  titleMaxLength: number;
  inventoryItemStatus?: string;
  saved: boolean;
}

function formSelect(label: string, name: string, options: string, value: string): string {
  return `<label class="form-field"><span>${label}</span><select data-listing-${name} aria-label="${label}">${options.replace(`value="${value}"`, `value="${value}" selected`)}</select></label>`;
}

function demoPage(): string {
  return `${renderPageHeader('Listing Generator', 'Create a draft to copy into a marketplace.', { demoPill: true })}<article class="card phase-card"><h2>Demo data mode</h2><p>Sign in to generate a real draft. Demo mode never calls Gemini and never publishes to a marketplace.</p></article>`;
}

export function renderListingGeneratorPage(state: AppState, options: ListingPageOptions): string {
  if (options.demoMode) return demoPage();
  const itemOptions = [
    ...options.inventory.map((item) => `<option value="${item.id}"${item.id === options.selectedItemId ? ' selected' : ''}>Inventory · ${escapeHtml(item.item_name)}${item.status === 'owned' ? ' · Owned' : ` · ${item.status}`}</option>`),
    ...(state.scanResult?.identified_item ? [`<option value="${state.scanResult.identified_item.id}"${state.scanResult.identified_item.id === options.selectedItemId ? ' selected' : ''}>Scanned · ${escapeHtml(state.scanResult.identified_item.name)}</option>`] : []),
  ].join('');
  const marketplaceOptions = options.marketplaces.map((marketplace) => `<option value="${marketplace.id}"${marketplace.id === options.selectedMarketplaceId ? ' selected' : ''}>${escapeHtml(marketplace.name)}</option>`).join('');
  const generated = options.generated;
  const title = generated?.title ?? '';
  const description = generated?.description ?? '';
  const condition = generated?.condition_description ?? '';
  const points = generated?.selling_points.join('\n') ?? '';
  const keywords = generated?.keywords.join(', ') ?? '';
  return `${renderPageHeader('Listing Generator', 'Review every detail before copying the draft.', { actions: '<span class="market-data-note">Draft only · never published</span>' })}
  <div class="listing-disclaimer" role="note">Drafts are for you to copy into a marketplace. ResaleIQ does not publish listings.</div>
  <section class="card listing-generator-form"><div class="card-heading"><div><h2>Listing setup</h2><p class="muted">Use confirmed product data only.</p></div>${options.aiMode === 'mock' ? '<span class="demo-pill">Demo mock AI</span>' : ''}</div><div class="form-grid listing-setup-grid">${formSelect('Item', 'item', `<option value="">Choose an item</option>${itemOptions}`, options.selectedItemId)}${formSelect('Marketplace', 'marketplace', `<option value="">Choose a marketplace</option>${marketplaceOptions}`, options.selectedMarketplaceId)}${formSelect('Tone', 'tone', '<option value="concise">Concise</option><option value="detailed">Detailed</option><option value="friendly">Friendly</option><option value="neutral">Neutral</option>', options.tone)}<label class="form-field"><span>Optional notes</span><textarea data-listing-notes aria-label="Optional notes" maxlength="1000" placeholder="Only add facts you have confirmed">${escapeHtml(options.notes)}</textarea><small><span data-notes-count>${options.notes.length}</span>/1000</small></label><label class="form-field"><span>Edited selling price (optional)</span><input data-listing-price aria-label="Edited selling price" type="number" min="0" step="0.01" value="${escapeHtml(options.price)}" placeholder="Uses the latest estimate"></label></div><div class="page-actions"><button class="button button-primary" type="button" data-action="generate-listing"${options.loading ? ' disabled' : ''}>${options.loading ? 'Generating…' : generated ? 'Regenerate' : 'Generate listing'}</button>${options.dirty ? '<span class="unsaved-warning" role="status">Unsaved edits</span>' : ''}</div></section>
  ${options.loading ? '<article class="card listing-loading"><div class="loading-skeleton"></div><div class="loading-skeleton short"></div><p>Preparing a factual draft…</p></article>' : ''}
  ${options.error ? `<article class="card form-alert form-alert-error" role="alert"><p>${escapeHtml(options.error)}</p><button class="button button-secondary" type="button" data-action="retry-listing">Retry</button></article>` : ''}
  ${generated ? `<article class="card generated-listing-card"><div class="card-heading"><div><h2>Review draft</h2><p class="muted">${options.aiMode === 'mock' ? 'Demo mock result — no Gemini call was made.' : 'AI-generated draft. Verify all claims before copying.'}</p></div><span class="character-count">Title limit: ${options.titleMaxLength}</span></div><label class="form-field"><span>Title</span><input data-listing-title aria-label="Listing title" maxlength="300" value="${escapeHtml(title)}"><small><span data-title-count>${title.length}</span>/${options.titleMaxLength}</small></label><p class="title-warning" data-title-warning${title.length > options.titleMaxLength ? '' : ' hidden'}>This title exceeds the marketplace limit.</p><label class="form-field"><span>Description</span><textarea data-listing-description aria-label="Listing description" rows="9">${escapeHtml(description)}</textarea><small><span data-description-count>${description.length}</span>/10000</small></label><label class="form-field"><span>Condition description</span><textarea data-listing-condition aria-label="Condition description" rows="3">${escapeHtml(condition)}</textarea></label><label class="form-field"><span>Main selling points (one per line)</span><textarea data-listing-points aria-label="Main selling points" rows="5">${escapeHtml(points)}</textarea></label><label class="form-field"><span>Keywords (comma-separated)</span><input data-listing-keywords aria-label="Keywords" value="${escapeHtml(keywords)}"></label><div class="generated-listing-actions"><button class="button button-secondary" type="button" data-action="copy-title">${options.copyMessage === 'title' ? 'Copied' : 'Copy title'}</button><button class="button button-secondary" type="button" data-action="copy-description">${options.copyMessage === 'description' ? 'Copied' : 'Copy description'}</button><button class="button button-secondary" type="button" data-action="copy-all">${options.copyMessage === 'all' ? 'Copied' : 'Copy all'}</button><button class="button button-primary" type="button" data-action="save-listing"${options.saving ? ' disabled' : ''}>${options.saving ? 'Saving…' : 'Save draft'}</button>${options.saved && options.inventoryItemStatus === 'owned' ? '<button class="button button-secondary" type="button" data-action="mark-listed">I posted it — mark Listed</button>' : ''}</div></article>` : '<article class="card empty-state"><h2>No draft yet</h2><p>Choose a confirmed item and marketplace, then generate a draft to review.</p></article>'}
  <section class="card drafts-card"><div class="card-heading"><div><h2>Saved drafts</h2><p class="muted">Deleted drafts are archived and no longer shown here.</p></div></div>${options.drafts.length ? `<div class="draft-list">${options.drafts.map((draft) => `<article class="draft-row"><div><strong>${escapeHtml(draft.title)}</strong><span>${draft.asking_price != null ? `${draft.asking_currency ?? ''} ${draft.asking_price}` : 'Price to be confirmed'} · Updated ${new Date(draft.updated_at).toLocaleDateString()}</span></div><div class="draft-actions"><button class="button button-secondary" type="button" data-action="open-draft" data-draft-id="${draft.id}">Open</button><button class="button button-secondary" type="button" data-action="delete-draft" data-draft-id="${draft.id}">Delete</button></div></article>`).join('')}</div>` : '<p class="empty-copy">No saved listing drafts yet.</p>'}</section>`;
}
