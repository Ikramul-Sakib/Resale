import type { Response } from 'express';
import type { RequestWithContext } from '../types/index.js';
import type { Services } from '../services/contracts.js';
import { AppError } from '../utils/errors.js';

function userId(req: RequestWithContext): string {
  if (!req.user) throw new AppError(401, 'UNAUTHORIZED', 'A valid bearer token is required.');
  return req.user.id;
}

function validated<T>(req: RequestWithContext, source: 'body' | 'params' | 'query'): T {
  return (req.validated?.[source] ?? {}) as T;
}

export function createControllers(services: Services) {
  return {
    health(_req: RequestWithContext, res: Response): void {
      res.status(200).json({ status: 'ok', service: 'resaleiq-api' });
    },

    async me(req: RequestWithContext, res: Response): Promise<void> {
      const result = await services.auth.me(req.user ?? (() => { throw new AppError(401, 'UNAUTHORIZED', 'A valid bearer token is required.'); })());
      res.json(result);
    },

    async listInventory(req: RequestWithContext, res: Response): Promise<void> {
      res.json(await services.inventory.list(userId(req), validated(req, 'query')));
    },
    async createInventory(req: RequestWithContext, res: Response): Promise<void> {
      res.status(201).json(await services.inventory.create(userId(req), validated(req, 'body')));
    },
    async getInventory(req: RequestWithContext, res: Response): Promise<void> {
      res.json(await services.inventory.get(userId(req), validated<{ id: string }>(req, 'params').id));
    },
    async updateInventory(req: RequestWithContext, res: Response): Promise<void> {
      const params = validated<{ id: string }>(req, 'params');
      res.json(await services.inventory.update(userId(req), params.id, validated(req, 'body')));
    },
    async deleteInventory(req: RequestWithContext, res: Response): Promise<void> {
      await services.inventory.delete(userId(req), validated<{ id: string }>(req, 'params').id);
      res.status(204).send();
    },

    async listSales(req: RequestWithContext, res: Response): Promise<void> {
      res.json(await services.sales.list(userId(req), validated(req, 'query')));
    },
    async createSale(req: RequestWithContext, res: Response): Promise<void> {
      res.status(201).json(await services.sales.record(userId(req), validated(req, 'body')));
    },

    async listMarketplaces(_req: RequestWithContext, res: Response): Promise<void> {
      res.json({ data: await services.marketplaces.list() });
    },
    async calculateFees(req: RequestWithContext, res: Response): Promise<void> {
      res.json(await services.fees.calculate(validated(req, 'body')));
    },
    async estimateItem(req: RequestWithContext, res: Response): Promise<void> {
      const params = validated<{ id: string }>(req, 'params');
      res.status(201).json(await services.pricing.estimate(userId(req), params.id, validated(req, 'body')));
    },
    async analyticsDashboard(req: RequestWithContext, res: Response): Promise<void> {
      res.json(await services.analytics.dashboard(userId(req)));
    },

    async listScans(req: RequestWithContext, res: Response): Promise<void> {
      res.json(await services.scans.list(userId(req), validated(req, 'query')));
    },
    async getScan(req: RequestWithContext, res: Response): Promise<void> {
      res.json(await services.scans.get(userId(req), validated<{ id: string }>(req, 'params').id));
    },
    async createScan(req: RequestWithContext, res: Response): Promise<void> {
      const body = validated<{ source: 'upload' | 'camera' }>(req, 'body');
      const files = Array.isArray(req.files) ? req.files : Object.values(req.files ?? {}).flat();
      res.status(201).json(await services.scans.create(userId(req), files, body.source));
    },
    async retryScan(req: RequestWithContext, res: Response): Promise<void> {
      res.json(await services.scans.retry(userId(req), validated<{ id: string }>(req, 'params').id));
    },
    async getItem(req: RequestWithContext, res: Response): Promise<void> {
      res.json(await services.items.get(userId(req), validated<{ id: string }>(req, 'params').id));
    },
    async updateItem(req: RequestWithContext, res: Response): Promise<void> {
      const params = validated<{ id: string }>(req, 'params');
      res.json(await services.items.update(userId(req), params.id, validated(req, 'body')));
    },

    async listListings(req: RequestWithContext, res: Response): Promise<void> {
      res.json(await services.listings.list(userId(req), validated(req, 'query')));
    },
    async createListing(req: RequestWithContext, res: Response): Promise<void> {
      res.status(201).json(await services.listings.create(userId(req), validated(req, 'body')));
    },
    async updateListing(req: RequestWithContext, res: Response): Promise<void> {
      const params = validated<{ id: string }>(req, 'params');
      res.json(await services.listings.update(userId(req), params.id, validated(req, 'body')));
    },
    async deleteListing(req: RequestWithContext, res: Response): Promise<void> {
      await services.listings.delete(userId(req), validated<{ id: string }>(req, 'params').id);
      res.status(204).send();
    },

    async pricingHistory(req: RequestWithContext, res: Response): Promise<void> {
      res.json(await services.pricing.history(userId(req), validated(req, 'query')));
    },
    async getEstimate(req: RequestWithContext, res: Response): Promise<void> {
      res.json(await services.estimates.get(userId(req), validated<{ id: string }>(req, 'params').id));
    },

    notImplemented(_req: RequestWithContext, _res: Response): never {
      throw new AppError(501, 'NOT_IMPLEMENTED', 'This feature requires the Gemini or image upload pipeline and is not enabled yet.');
    },
  };
}
