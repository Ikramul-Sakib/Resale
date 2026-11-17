export function pageOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

export function totalPages(total: number, limit: number): number {
  return total === 0 ? 0 : Math.ceil(total / limit);
}

export function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(value);
}
