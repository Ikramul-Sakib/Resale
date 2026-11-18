import { describe, expect, it } from 'vitest';
import { createRepositories } from '../src/repositories/supabase.js';
import type { SupabaseDatabaseClient } from '../src/config/supabase.js';
import { salesCreateSchema } from '../src/validators/schemas.js';

// A query recorder checks relationships and filters, while returning realistic rows.
function database(tables: Record<string, unknown[]>) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
  const client = { from(table: string) {
    const query: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'in', 'or', 'ilike', 'order', 'range', 'limit']) {
      query[method] = (...args: unknown[]) => { calls.push({ table, method, args }); return query; };
    }
    query.then = (resolve: (value: unknown) => unknown) => resolve({ data: tables[table] ?? [], error: null, count: tables[table]?.length ?? 0 });
    return query;
  } };
  return { repositories: createRepositories(client as unknown as SupabaseDatabaseClient), calls };
}

describe('review regressions', () => {
  it('subtracts purchase cost from profit while keeping net proceeds separate', async () => {
    const { repositories } = database({
      inventory_items: [{ id: 'inventory', status: 'sold', purchase_price: 800 }],
      sales: [{ inventory_item_id: 'inventory', sale_price: 1000, sale_currency: 'BDT', net_earnings: 900, net_currency: 'BDT', sold_at: '2026-11-18T00:00:00Z' }],
    });
    const result = await repositories.analytics.dashboard('owner');
    expect(result.sales.profit_by_currency).toEqual({ BDT: 100 });
    expect(result.sales.net_earnings).toBe(900);
  });

  it('uses purchase cost captured at sale time after inventory cost changes', async () => {
    const { repositories } = database({
      inventory_items: [{ id: 'inventory', status: 'sold', purchase_price: 50 }],
      sales: [{ inventory_item_id: 'inventory', sale_price: 1000, sale_currency: 'BDT', net_earnings: 900, net_currency: 'BDT', sold_at: '2026-11-18T00:00:00Z', attributes: { purchase_cost: 800 } }],
    });
    expect((await repositories.analytics.dashboard('owner')).sales.profit_by_currency).toEqual({ BDT: 100 });
  });

  it('looks up inventory IDs before querying category sales', async () => {
    const { repositories, calls } = database({ categories: [{ id: 'category', name: 'Camera' }], identified_items: [{ id: 'identified' }], inventory_items: [{ id: 'inventory' }] });
    await repositories.priceGuides.list('owner', { page: 1, limit: 25 });
    expect(calls).toContainEqual({ table: 'inventory_items', method: 'in', args: ['identified_item_id', ['identified']] });
    expect(calls).toContainEqual({ table: 'sales', method: 'in', args: ['inventory_item_id', ['inventory']] });
  });

  it('searches scan IDs through their text representation', async () => {
    const { repositories, calls } = database({});
    await repositories.scans.list('owner', { page: 1, limit: 25, search: 'abcd' });
    expect(calls).toContainEqual({ table: 'scans', method: 'ilike', args: ['id_search', '%abcd%'] });
  });

  it('accepts a sale whose expenses exceed its price', () => {
    expect(salesCreateSchema.safeParse({ inventory_item_id: '10000000-0000-4000-8000-000000000001', sale_price: 10, sale_currency: 'BDT', fee_amount: 20, fee_currency: 'BDT', net_earnings: -10, net_currency: 'BDT' }).success).toBe(true);
  });
});
