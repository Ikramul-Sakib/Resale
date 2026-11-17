import type { IdentificationFields } from '../types';
import { escapeHtml } from '../utils/html';
import { renderPageHeader } from '../components/page-header';

function renderField(label: string, field: keyof IdentificationFields, value: string): string {
  return `
    <label class="form-field">
      <span>${label}</span>
      <input type="text" data-field="${field}" value="${escapeHtml(value)}" />
    </label>
  `;
}

export function renderIdentificationPage(fields: IdentificationFields): string {
  return `
    ${renderPageHeader('Identification results', 'Review and correct what the AI found.', { demoPill: true })}

    <section class="identification-layout">
      <div class="identification-photo" role="img" aria-label="Uploaded product photo placeholder">
        <i data-lucide="image" aria-hidden="true"></i>
        <span>Uploaded photo (sample)</span>
      </div>
      <article class="card identification-form-card">
        <div class="form-grid">
          ${renderField('Product name', 'name', fields.name)}
          ${renderField('Brand', 'brand', fields.brand)}
          ${renderField('Model', 'model', fields.model)}
          ${renderField('Category', 'category', fields.category)}
          ${renderField('Condition', 'condition', fields.condition)}
          ${renderField('Key attributes', 'attributes', fields.attributes)}
        </div>
        <p class="confidence-note"><i data-lucide="info" aria-hidden="true"></i> AI identification confidence: High. This is the model's own estimate, not a verified match.</p>
      </article>
    </section>

    <div class="page-actions">
      <button class="button button-primary" type="button" data-action="continue-estimate">Continue to Price Estimation</button>
    </div>
  `;
}
