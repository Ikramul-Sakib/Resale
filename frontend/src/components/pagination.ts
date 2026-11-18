export function renderPagination(page: number, totalPages: number, prefix: string): string {
  if (totalPages <= 1 && page <= 1) return '';
  return `<nav class="page-actions" aria-label="Pagination"><button class="button button-secondary" data-action="${prefix}-prev" ${page <= 1 ? 'disabled' : ''}>Previous</button><span>Page ${page} of ${Math.max(page, totalPages)}</span><button class="button button-secondary" data-action="${prefix}-next" ${page >= totalPages ? 'disabled' : ''}>Next</button></nav>`;
}
