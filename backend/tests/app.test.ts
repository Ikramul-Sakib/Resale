import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import type { Services } from '../src/services/contracts.js';
import type { AnalyticsDashboard, FeeCalculationResult } from '../src/repositories/contracts.js';
import type { InventoryItem, ListingDraft, Marketplace, Page, SalesRecord } from '../src/types/index.js';
import { AppError } from '../src/utils/errors.js';

const USER_A = '00000000-0000-0000-0000-0000000000a1';
const USER_B = '00000000-0000-0000-0000-0000000000b1';
const ITEM_A = '10000000-0000-4000-8000-0000000000a1';
const ITEM_B = '10000000-0000-4000-8000-0000000000b1';
const MARKETPLACE_ID = '30000000-0000-4000-8000-0000000000a1';

const env = {
  corsOrigins: ['http://localhost:5173'],
  JSON_BODY_LIMIT: '1mb',
  RATE_LIMIT_WINDOW_MS: 900000,
  RATE_LIMIT_MAX: 1000,
};

function now(): string {
  return '2026-11-17T00:00:00.000Z';
}

function makeItem(id: string, userId: string, itemName: string): InventoryItem {
  return {
    id,
    user_id: userId,
    item_name: itemName,
    status: 'owned',
    condition: 'Good',
    attributes: {},
    estimated_value: 79,
    estimated_value_currency: 'BDT',
    created_at: now(),
    updated_at: now(),
  };
}

function paginate<T>(rows: T[], page = 1, limit = 25): Page<T> {
  return {
    data: rows.slice((page - 1) * limit, page * limit),
    page,
    limit,
    total: rows.length,
    total_pages: rows.length === 0 ? 0 : Math.ceil(rows.length / limit),
  };
}

function makeServices(): { services: Services; items: InventoryItem[]; sales: SalesRecord[] } {
  const items = [makeItem(ITEM_A, USER_A, 'User A keyboard'), makeItem(ITEM_B, USER_B, 'User B camera')];
  const sales: SalesRecord[] = [];
  const listings: ListingDraft[] = [];

  const services: Services = {
    auth: {
      async me(user) {
        return { user, profile: null };
      },
    },
    inventory: {
      async list(userId, options) {
        let rows = items.filter((item) => item.user_id === userId);
        if (options.search) rows = rows.filter((item) => item.item_name.toLowerCase().includes(options.search!.toLowerCase()));
        if (options.status) rows = rows.filter((item) => item.status === options.status);
        return paginate(rows, options.page, options.limit);
      },
      async create(userId, input) {
        const item: InventoryItem = {
          ...(input as InventoryItem),
          id: '50000000-0000-4000-8000-0000000000a1',
          user_id: userId,
          item_name: input.item_name,
          status: input.status ?? 'owned',
          attributes: input.attributes ?? {},
          created_at: now(),
          updated_at: now(),
        };
        items.push(item);
        return item;
      },
      async get(userId, id) {
        const item = items.find((candidate) => candidate.id === id && candidate.user_id === userId);
        if (!item) throw new AppError(404, 'NOT_FOUND', 'Inventory item was not found.');
        return item;
      },
      async update(userId, id, input) {
        const item = items.find((candidate) => candidate.id === id && candidate.user_id === userId);
        if (!item) throw new AppError(404, 'NOT_FOUND', 'Inventory item was not found.');
        Object.assign(item, input, { updated_at: now() });
        return item;
      },
      async delete(userId, id) {
        const index = items.findIndex((candidate) => candidate.id === id && candidate.user_id === userId);
        if (index < 0) throw new AppError(404, 'NOT_FOUND', 'Inventory item was not found.');
        items.splice(index, 1);
      },
    },
    sales: {
      async list(userId, options) {
        return paginate(sales.filter((sale) => sale.user_id === userId), options.page, options.limit);
      },
      async record(userId, input) {
        const item = items.find((candidate) => candidate.id === input.inventory_item_id && candidate.user_id === userId);
        if (!item || item.status === 'sold') throw new AppError(404, 'NOT_FOUND', 'Inventory item was not found or is already sold.');
        item.status = 'sold';
        const sale: SalesRecord = {
          ...input,
          id: `sale-${sales.length + 1}`,
          user_id: userId,
          fee_amount: input.fee_amount,
          attributes: input.attributes,
          created_at: now(),
          updated_at: now(),
        };
        sales.push(sale);
        return sale;
      },
    },
    marketplaces: {
      async list(): Promise<Marketplace[]> {
        return [{ id: MARKETPLACE_ID, slug: 'fixture', name: 'Fixture marketplace', is_active: true, created_at: now(), updated_at: now() }];
      },
    },
    fees: {
      async calculate(input): Promise<FeeCalculationResult> {
        if (input.manual_percentage !== undefined) return { marketplace_id: input.marketplace_id, sale_price: input.sale_price, currency: input.currency, fee_amount: input.sale_price * input.manual_percentage / 100, status: 'user_entered_unverified', rule: { id: null, name: 'User-entered percentage (unverified)', fee_type: 'percentage', source: 'user_input', verified_at: null, percentage_rate: input.manual_percentage, fixed_amount: null, currency: input.currency } };
        return {
          marketplace_id: input.marketplace_id,
          sale_price: input.sale_price,
          currency: input.currency,
          fee_amount: 10,
          rule: {
            id: '40000000-0000-4000-8000-0000000000a1',
            name: 'Fixture verified rule',
            fee_type: 'fixed',
            source: 'test fixture',
            verified_at: now(),
            percentage_rate: null,
            fixed_amount: 10,
            currency: input.currency,
          },
        };
      },
    },
    analytics: {
      async dashboard(userId): Promise<AnalyticsDashboard> {
        const own = items.filter((item) => item.user_id === userId);
        const ownSales = sales.filter((sale) => sale.user_id === userId);
        return {
          inventory: {
            owned: own.filter((item) => item.status === 'owned').length,
            listed: own.filter((item) => item.status === 'listed').length,
            sold: own.filter((item) => item.status === 'sold').length,
            archived: own.filter((item) => item.status === 'archived').length,
            estimated_value: own.reduce((sum, item) => sum + Number(item.estimated_value ?? 0), 0),
          },
          sales: { count: ownSales.length, net_earnings: ownSales.reduce((sum, sale) => sum + sale.net_earnings, 0) },
        };
      },
    },
    scans: {
      async list(userId, options) { return paginate([{ id: 'scan-a', user_id: userId }], options.page, options.limit); },
      async get(userId, id) {
        if (userId !== USER_A || id !== 'scan-a') throw new AppError(404, 'NOT_FOUND', 'Scan was not found.');
        return { id, user_id: userId };
      },
      async create() { throw new AppError(501, 'NOT_IMPLEMENTED', 'This feature requires the Gemini or image upload pipeline and is not enabled yet.'); },
      async retry() { throw new AppError(501, 'NOT_IMPLEMENTED', 'This feature requires the Gemini or image upload pipeline and is not enabled yet.'); },
    },
    items: {
      async get(userId, id) {
        if (userId !== USER_A || id !== 'item-a') throw new AppError(404, 'NOT_FOUND', 'Item was not found.');
        return { id, user_id: userId, name: 'Test item' };
      },
      async update(userId, id, input) {
        if (userId !== USER_A || id !== 'item-a') throw new AppError(404, 'NOT_FOUND', 'Item was not found.');
        return { id, user_id: userId, ...input };
      },
    },
    listings: {
      async generate() { throw new AppError(501, 'NOT_IMPLEMENTED', 'Listing generation is not configured.'); },
      async list(userId, options) { return paginate(listings.filter((listing) => listing.user_id === userId), options.page, options.limit); },
      async get(userId, id) { const listing = listings.find((candidate) => candidate.id === id && candidate.user_id === userId); if (!listing) throw new AppError(404, 'NOT_FOUND', 'Listing draft was not found.'); return listing; },
      async create(userId, input) {
        const listing = { ...input, id: '60000000-0000-4000-8000-0000000000a1', user_id: userId, attributes: input.attributes, created_at: now(), updated_at: now() } as ListingDraft;
        listings.push(listing);
        return listing;
      },
      async update(userId, id, input) {
        const listing = listings.find((candidate) => candidate.id === id && candidate.user_id === userId);
        if (!listing) throw new AppError(404, 'NOT_FOUND', 'Listing draft was not found.');
        Object.assign(listing, input, { updated_at: now() });
        return listing;
      },
      async delete(userId, id) {
        const index = listings.findIndex((candidate) => candidate.id === id && candidate.user_id === userId);
        if (index < 0) throw new AppError(404, 'NOT_FOUND', 'Listing draft was not found.');
        listings.splice(index, 1);
      },
    },
    pricing: {
      async estimate(userId, itemId) { if (userId !== USER_A || itemId !== '10000000-0000-4000-8000-0000000000a1') throw new AppError(404, 'NOT_FOUND', 'Item was not found.'); return { estimate: {}, ai_mode: 'mock' as const, market_data_status: 'not_connected' as const, fee: null }; },
      async history(userId, options) { return paginate([{ id: 'estimate-a', user_id: userId }], options.page, options.limit); },
    },
    estimates: {
      async get(userId, id) {
        if (userId !== USER_A || id !== 'estimate-a') throw new AppError(404, 'NOT_FOUND', 'Estimate was not found.');
        return { id, user_id: userId };
      },
    },
  };

  return { services, items, sales };
}

function makeApp(appEnv = env) {
  const test = makeServices();
  const app = createApp({
    env: appEnv,
    services: test.services,
    verifier: {
      async verify(token) {
        if (token === 'user-a-token') return { id: USER_A, email: 'a@example.test' };
        if (token === 'user-b-token') return { id: USER_B, email: 'b@example.test' };
        throw new Error('invalid token');
      },
    },
  });
  return { app, ...test };
}

describe('ResaleIQ API', () => {
  it.each([
    ['development', 'http://127.0.0.1:5173', 204],
    ['development', 'http://127.0.0.1:5174', 403],
    ['production', 'http://127.0.0.1:5173', 403],
  ] as const)('applies the %s scan-upload CORS allowlist to %s', async (mode, origin, status) => {
    const appEnv = loadEnv({
      NODE_ENV: mode,
      CORS_ORIGIN: 'http://localhost:5173',
      SUPABASE_URL: 'http://127.0.0.1:54321',
      SUPABASE_SERVICE_ROLE_KEY: 'test-key',
    });
    const { app } = makeApp(appEnv);
    const response = await request(app).options('/api/v1/scans')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization');

    expect(response.status).toBe(status);
    expect(response.headers['access-control-allow-origin']).toBe(status === 204 ? origin : undefined);
  });

  it('requires authentication on protected routes', async () => {
    const { app } = makeApp();
    const response = await request(app).get('/api/v1/inventory');
    expect(response.status).toBe(401);
    expect(response.body.error).toMatchObject({ code: 'UNAUTHORIZED' });
    expect(response.body.error.request_id).toEqual(expect.any(String));
  });

  it('rejects an invalid bearer token without leaking verifier details', async () => {
    const { app } = makeApp();
    const response = await request(app).get('/api/v1/inventory').set('Authorization', 'Bearer invalid-token');
    expect(response.status).toBe(401);
    expect(response.body.error).toMatchObject({ code: 'UNAUTHORIZED', message: 'A valid bearer token is required.' });
    expect(response.body.error.message).not.toContain('invalid token');
  });

  it('rejects an expired bearer token as unauthorized', async () => {
    const { app } = makeApp();
    const response = await request(app).get('/api/v1/inventory').set('Authorization', 'Bearer expired-token');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns a consistent error shape for missing routes', async () => {
    const { app } = makeApp();
    const response = await request(app).get('/missing');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: expect.objectContaining({ code: 'NOT_FOUND', message: expect.any(String), request_id: expect.any(String) }) });
    expect(response.body.error.stack).toBeUndefined();
  });

  it('validates request bodies and rejects user_id injection', async () => {
    const { app } = makeApp();
    const response = await request(app)
      .post('/api/v1/inventory')
      .set('Authorization', 'Bearer user-a-token')
      .send({ item_name: 'Injected', user_id: USER_B });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('supports inventory CRUD for the authenticated owner', async () => {
    const { app } = makeApp();
    const headers = { Authorization: 'Bearer user-a-token' };
    const created = await request(app).post('/api/v1/inventory').set(headers).send({ item_name: 'Desk lamp', attributes: {} });
    expect(created.status).toBe(201);
    const id = created.body.id as string;

    const listed = await request(app).get('/api/v1/inventory?page=1&limit=10').set(headers);
    expect(listed.status).toBe(200);
    expect(listed.body.total).toBe(2);

    const updated = await request(app).patch(`/api/v1/inventory/${id}`).set(headers).send({ status: 'listed' });
    expect(updated.status).toBe(200);
    expect(updated.body.status).toBe('listed');

    const fetched = await request(app).get(`/api/v1/inventory/${id}`).set(headers);
    expect(fetched.status).toBe(200);
    expect(fetched.body.item_name).toBe('Desk lamp');

    const deleted = await request(app).delete(`/api/v1/inventory/${id}`).set(headers);
    expect(deleted.status).toBe(204);
  });

  it('prevents user A from reading or modifying user B inventory', async () => {
    const { app } = makeApp();
    const response = await request(app).get(`/api/v1/inventory/${ITEM_B}`).set('Authorization', 'Bearer user-a-token');
    expect(response.status).toBe(404);
    const update = await request(app).patch(`/api/v1/inventory/${ITEM_B}`).set('Authorization', 'Bearer user-a-token').send({ status: 'archived' });
    expect(update.status).toBe(404);
  });

  it('prevents cross-user scan reads and item edits', async () => {
    const { app } = makeApp();
    const scan = await request(app).get('/api/v1/scans/20000000-0000-4000-8000-0000000000b1').set('Authorization', 'Bearer user-a-token');
    expect(scan.status).toBe(404);
    const item = await request(app).patch('/api/v1/items/10000000-0000-4000-8000-0000000000b1').set('Authorization', 'Bearer user-a-token').send({ name: 'Injected' });
    expect(item.status).toBe(404);
  });

  it('records a sale and marks the inventory item sold through the service transaction boundary', async () => {
    const { app, items, sales } = makeApp();
    const response = await request(app).post('/api/v1/sales').set('Authorization', 'Bearer user-a-token').send({
      inventory_item_id: ITEM_A,
      sale_price: 80,
      sale_currency: 'BDT',
      fee_amount: 10,
      fee_currency: 'BDT',
      net_earnings: 70,
      net_currency: 'BDT',
    });
    expect(response.status).toBe(201);
    expect(response.body.user_id).toBe(USER_A);
    expect(items.find((item) => item.id === ITEM_A)?.status).toBe('sold');
    expect(sales).toHaveLength(1);
  });

  it('calculates fees from a configured rule and returns provenance', async () => {
    const { app } = makeApp();
    const response = await request(app).post('/api/v1/fees/calculate').set('Authorization', 'Bearer user-a-token').send({
      marketplace_id: MARKETPLACE_ID, sale_price: 100, currency: 'BDT',
    });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ fee_amount: 10, rule: { source: 'test fixture', verified_at: now() } });
  });

  it('marks a user-entered fee percentage as unverified', async () => {
    const { app } = makeApp();
    const response = await request(app).post('/api/v1/fees/calculate').set('Authorization', 'Bearer user-a-token').send({ marketplace_id: MARKETPLACE_ID, sale_price: 100, currency: 'BDT', manual_percentage: 12 });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ fee_amount: 12, status: 'user_entered_unverified', rule: { verified_at: null, source: 'user_input' } });
  });

  it('does not estimate an item owned by another user', async () => {
    const { app } = makeApp();
    const response = await request(app).post('/api/v1/items/10000000-0000-4000-8000-0000000000b1/estimate').set('Authorization', 'Bearer user-a-token').send({ currency: 'BDT' });
    expect(response.status).toBe(404);
  });

  it('validates, isolates, and supports listing draft endpoints', async () => {
    const { app } = makeApp();
    const headers = { Authorization: 'Bearer user-a-token' };
    const invalid = await request(app).post('/api/v1/listings').set(headers).send({ title: 'Missing source', attributes: {} });
    expect(invalid.status).toBe(400);
    const created = await request(app).post('/api/v1/listings').set(headers).send({ identified_item_id: '10000000-0000-4000-8000-0000000000a1', title: 'Confirmed draft', description: 'Facts only', attributes: {}, status: 'draft' });
    expect(created.status).toBe(201);
    const listingId = created.body.id as string;
    expect((await request(app).get('/api/v1/listings').set(headers)).status).toBe(200);
    expect((await request(app).get(`/api/v1/listings/${listingId}`).set('Authorization', 'Bearer user-b-token')).status).toBe(404);
    expect((await request(app).patch(`/api/v1/listings/${listingId}`).set('Authorization', 'Bearer user-b-token').send({ title: 'No access' })).status).toBe(404);
    expect((await request(app).delete(`/api/v1/listings/${listingId}`).set('Authorization', 'Bearer user-b-token')).status).toBe(404);
  });

  it('returns database-backed analytics through the service contract', async () => {
    const { app } = makeApp();
    const response = await request(app).get('/api/v1/analytics/dashboard').set('Authorization', 'Bearer user-a-token');
    expect(response.status).toBe(200);
    expect(response.body.inventory).toMatchObject({ owned: 1, estimated_value: 79 });
  });

  it('returns 501 for Gemini-dependent work without fabricating results', async () => {
    const { app } = makeApp();
    const response = await request(app).post('/api/v1/scans').set('Authorization', 'Bearer user-a-token').send({});
    expect(response.status).toBe(501);
    expect(response.body.error).toMatchObject({ code: 'NOT_IMPLEMENTED' });
  });
});
