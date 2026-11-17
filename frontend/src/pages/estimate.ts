import type { AppState } from '../types';
import { formatMoney } from '../utils/html';
import { renderPageHeader } from '../components/page-header';

export function renderEstimatePage(state: AppState): string {
  const symbol = state.currency === 'USD' ? '$' : state.currency === 'EUR' ? '€' : '£';
  const fee = state.currency === 'USD' ? 10 : 9;
  const net = 79 - fee;
  const currencyControl = `
    <label class="currency-control">
      <span>Currency</span>
      <select data-currency aria-label="Estimate currency">
        ${['USD', 'EUR', 'GBP'].map((currency) => `<option value="${currency}"${currency === state.currency ? ' selected' : ''}>${currency}</option>`).join('')}
      </select>
    </label>
  `;

  return `
    ${renderPageHeader('Resale price estimate', 'Keychron K2 mechanical keyboard.', { demoPill: true, actions: currencyControl })}

    <section class="estimate-cards" aria-label="Demo price estimates">
      <article class="estimate-card"><span>Low estimate</span><strong>${formatMoney(55, state.currency)}</strong></article>
      <article class="estimate-card is-typical"><span>Typical market price</span><strong>${formatMoney(79, state.currency)}</strong></article>
      <article class="estimate-card"><span>High estimate</span><strong>${formatMoney(95, state.currency)}</strong></article>
    </section>

    <article class="card price-range-card">
      <div class="card-heading"><h2>Price range</h2></div>
      <div class="range-bar" aria-label="Estimated price range from ${symbol}55 to ${symbol}95"><span></span></div>
      <dl class="money-list">
        <div><dt>Suggested selling price</dt><dd>${formatMoney(79, state.currency)}</dd></div>
        <div><dt>Estimated marketplace fees (about 13%)</dt><dd>-${formatMoney(fee, state.currency)}</dd></div>
        <div><dt>Estimated net earnings</dt><dd>${formatMoney(net, state.currency)}</dd></div>
      </dl>
    </article>

    <section class="estimate-detail-grid">
      <article class="card detail-card">
        <div class="card-heading"><h2>Factors affecting the price</h2></div>
        <ul class="factor-list">
          <li><span>Condition: light wear</span><b>-5%</b></li>
          <li><span>Original box included</span><b>+4%</b></li>
          <li><span>Model age</span><b>-8%</b></li>
        </ul>
      </article>
      <article class="card detail-card methodology-card">
        <div class="card-heading"><h2>How this was estimated</h2></div>
        <p>This is an AI-generated estimate based on the photo and product details. It is not verified sales data and does not use live marketplace prices.</p>
        <p class="last-updated">Last updated: Nov 17, 2026</p>
      </article>
    </section>

    <div class="page-actions">
      <button class="button button-primary" type="button" data-action="generate-listing">Generate Listing</button>
      <button class="button button-secondary" type="button" data-action="save-inventory">Save to Inventory</button>
    </div>
  `;
}
