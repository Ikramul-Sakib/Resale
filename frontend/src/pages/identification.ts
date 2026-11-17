import type { IdentifiedItem } from '../services/api';
import type { IdentificationFields } from '../types';
import { escapeHtml } from '../utils/html';
import { renderPageHeader } from '../components/page-header';

interface IdentificationView {
  itemId?: string;
  name: string;
  brand: string;
  model: string;
  category: string;
  productType: string;
  condition: string;
  attributes: string;
  notes: string;
  imageUrl?: string;
  aiMode?: 'real' | 'mock';
  empty?: boolean;
}

function fromItem(item: IdentifiedItem): IdentificationView {
  return {
    itemId: item.id,
    name: item.name === 'Unknown item' ? '' : item.name,
    brand: item.brand_text ?? '',
    model: item.model ?? '',
    category: item.category_text ?? '',
    productType: item.product_type ?? '',
    condition: item.condition ?? '',
    attributes: Object.entries(item.key_attributes ?? {}).map(([key, value]) => `${key}: ${String(value)}`).join(', '),
    notes: item.identification_notes ?? '',
  };
}

function renderField(label: string, field: string, value: string): string {
  return `<label class="form-field"><span>${label}</span><input type="text" data-field="${field}" value="${escapeHtml(value)}" aria-label="${label}" /></label>`;
}

export function renderIdentificationPage(fields: IdentificationFields | IdentifiedItem, imageUrl?: string, aiMode: 'real' | 'mock' = 'mock', empty = false, saving = false): string {
  const view: IdentificationView = 'id' in fields ? fromItem(fields) : { ...fields, productType: '', notes: '' };
  view.imageUrl = imageUrl; view.aiMode = aiMode; view.empty = empty;
  return `
    ${renderPageHeader('Identification results', 'Review and correct what the AI found.', { demoPill: aiMode === 'mock' })}
    ${aiMode === 'mock' ? '<div class="form-alert form-alert-error" role="alert">Demo mock result — no Gemini call was made. These fields are not AI output.</div>' : ''}
    ${empty ? '<div class="form-alert form-alert-success" role="status">Nothing could be identified reliably. Fill in the fields manually.</div>' : ''}
    <section class="identification-layout">
      <div class="identification-photo" role="img" aria-label="Uploaded product photo">
        ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="Uploaded product photo" />` : '<i data-lucide="image" aria-hidden="true"></i><span>No preview available</span>'}
      </div>
      <article class="card identification-form-card">
        <div class="form-grid">
          ${renderField('Product name', 'name', view.name)}
          ${renderField('Brand', 'brand', view.brand)}
          ${renderField('Model', 'model', view.model)}
          ${renderField('Category', 'category', view.category)}
          ${renderField('Product type', 'productType', view.productType)}
          ${renderField('Condition', 'condition', view.condition)}
          ${renderField('Key attributes', 'attributes', view.attributes)}
        </div>
        ${view.notes ? `<p class="muted-copy identification-notes">${escapeHtml(view.notes)}</p>` : ''}
        <p class="confidence-note"><i data-lucide="info" aria-hidden="true"></i> Confidence is the model's own estimate, not a verified match.</p>
        ${view.itemId ? `<button class="button button-secondary" type="button" data-action="save-identification"${saving ? ' disabled' : ''}>${saving ? 'Saving…' : 'Save changes'}</button>` : ''}
      </article>
    </section>
    <div class="page-actions"><button class="button button-primary" type="button" data-action="continue-estimate">Continue to Price Estimation</button></div>
  `;
}
