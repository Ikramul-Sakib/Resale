import { renderPageHeader } from '../components/page-header';
import { escapeHtml } from '../utils/html';

export interface DashboardView {
  scannedItems: number;
  inventoryValue: number;
  listedItems: number;
  soldItems: number;
  totalProfit: number;
  recentScans: Array<{ label: string; time: string }>;
  owned: number;
  listed: number;
  sold: number;
  activity: Array<{ label: string; time: string }>;
}

interface DashboardOptions {
  demoMode: boolean;
  displayName: string;
  data?: DashboardView;
  loading?: boolean;
}

const demoData: DashboardView = {
  scannedItems: 86,
  inventoryValue: 4210,
  listedItems: 12,
  soldItems: 7,
  totalProfit: 612,
  recentScans: [
    { label: 'Mechanical keyboard, est. $60–$95', time: '2 min ago' },
    { label: 'Film camera, est. $120–$210', time: 'Yesterday' },
    { label: 'Running shoes, est. $25–$48', time: '2 days ago' },
  ],
  owned: 24,
  listed: 12,
  sold: 7,
  activity: [
    { label: 'Listing draft saved: Film camera', time: 'Today' },
    { label: 'Sold: Desk lamp, profit $18', time: 'Yesterday' },
    { label: 'Added to inventory: Running shoes', time: '2 days ago' },
  ],
};

function money(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function renderList(rows: Array<{ label: string; time: string }>, empty: string): string {
  return rows.length
    ? rows.map((row) => `<li><span>${escapeHtml(row.label)}</span><time>${escapeHtml(row.time)}</time></li>`).join('')
    : `<li class="empty-list"><span>${escapeHtml(empty)}</span></li>`;
}

export function renderDashboardPage(options: DashboardOptions): string {
  const data = options.data ?? (options.demoMode ? demoData : {
    scannedItems: 0, inventoryValue: 0, listedItems: 0, soldItems: 0, totalProfit: 0,
    recentScans: [], owned: 0, listed: 0, sold: 0, activity: [],
  });
  const title = options.demoMode ? 'Welcome back, Alex' : `Welcome back, ${options.displayName || 'there'}`;
  return `
    ${renderPageHeader(title, options.loading ? 'Loading your resale snapshot…' : 'Here is your resale snapshot.', {
      demoPill: options.demoMode,
      actions: '<button class="button button-primary" type="button" data-action="scan">Scan New Product</button>',
    })}

    <section class="stats-grid" aria-label="Resale statistics">
      <article class="stat-card"><span>Total Scanned Items</span><strong>${data.scannedItems}</strong></article>
      <article class="stat-card"><span>Inventory Value</span><strong>${money(data.inventoryValue)}</strong></article>
      <article class="stat-card"><span>Listed Items</span><strong>${data.listedItems}</strong></article>
      <article class="stat-card"><span>Items Sold</span><strong>${data.soldItems}</strong></article>
      <article class="stat-card stat-card-wide"><span>Total Profit</span><strong>${money(data.totalProfit)}</strong></article>
    </section>

    <section class="dashboard-grid">
      <article class="card list-card">
        <div class="card-heading"><h2>Recent scans</h2></div>
        <ul class="data-list">
          ${renderList(data.recentScans, 'No scans yet. Start with a product photo.')}
        </ul>
      </article>

      <article class="card inventory-overview">
        <div class="card-heading"><h2>Inventory overview</h2></div>
        <div class="progress-list">
          <div class="progress-row"><div><span>Owned</span><b>${data.owned}</b></div><span class="progress-track"><span style="width: ${Math.min(100, data.owned * 2.3)}%"></span></span></div>
          <div class="progress-row"><div><span>Listed</span><b>${data.listed}</b></div><span class="progress-track"><span style="width: ${Math.min(100, data.listed * 2.3)}%"></span></span></div>
          <div class="progress-row"><div><span>Sold</span><b>${data.sold}</b></div><span class="progress-track"><span style="width: ${Math.min(100, data.sold * 2.3)}%"></span></span></div>
        </div>
      </article>
    </section>

    <article class="card list-card activity-card">
      <div class="card-heading"><h2>Recent activity</h2></div>
      <ul class="data-list">
        ${renderList(data.activity, 'No recent activity yet.')}
      </ul>
    </article>
  `;
}
