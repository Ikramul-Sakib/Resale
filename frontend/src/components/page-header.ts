export function renderPageHeader(
  title: string,
  subtitle: string,
  options: { demoPill?: boolean; actions?: string } = {},
): string {
  return `
    <div class="page-header">
      <div>
        <h1>${title}</h1>
        <div class="page-subtitle">
          <span>${subtitle}</span>
          ${options.demoPill ? '<span class="demo-pill">Demo data</span>' : ''}
        </div>
      </div>
      ${options.actions ?? ''}
    </div>
  `;
}
