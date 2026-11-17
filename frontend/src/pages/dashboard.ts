import { renderPageHeader } from '../components/page-header';

export function renderDashboardPage(): string {
  return `
    ${renderPageHeader('Welcome back, Alex', 'Here is your resale snapshot.', {
      demoPill: true,
      actions: '<button class="button button-primary" type="button" data-action="scan">Scan New Product</button>',
    })}

    <section class="stats-grid" aria-label="Demo resale statistics">
      <article class="stat-card"><span>Total Scanned Items</span><strong>86</strong></article>
      <article class="stat-card"><span>Inventory Value</span><strong>$4,210</strong></article>
      <article class="stat-card"><span>Listed Items</span><strong>12</strong></article>
      <article class="stat-card"><span>Items Sold</span><strong>7</strong></article>
      <article class="stat-card stat-card-wide"><span>Total Profit</span><strong>$612</strong></article>
    </section>

    <section class="dashboard-grid">
      <article class="card list-card">
        <div class="card-heading"><h2>Recent scans</h2></div>
        <ul class="data-list">
          <li><span>Mechanical keyboard, est. $60–$95</span><time>2 min ago</time></li>
          <li><span>Film camera, est. $120–$210</span><time>Yesterday</time></li>
          <li><span>Running shoes, est. $25–$48</span><time>2 days ago</time></li>
        </ul>
      </article>

      <article class="card inventory-overview">
        <div class="card-heading"><h2>Inventory overview</h2></div>
        <div class="progress-list">
          <div class="progress-row"><div><span>Owned</span><b>24</b></div><span class="progress-track"><span style="width: 55%"></span></span></div>
          <div class="progress-row"><div><span>Listed</span><b>12</b></div><span class="progress-track"><span style="width: 30%"></span></span></div>
          <div class="progress-row"><div><span>Sold</span><b>7</b></div><span class="progress-track"><span style="width: 18%"></span></span></div>
        </div>
      </article>
    </section>

    <article class="card list-card activity-card">
      <div class="card-heading"><h2>Recent activity</h2></div>
      <ul class="data-list">
        <li><span>Listing draft saved: Film camera</span><time>Today</time></li>
        <li><span>Sold: Desk lamp, profit $18</span><time>Yesterday</time></li>
        <li><span>Added to inventory: Running shoes</span><time>2 days ago</time></li>
      </ul>
    </article>
  `;
}
