import { Router } from 'express';
import type { Services } from '../services/contracts.js';
import type { TokenVerifier } from '../middleware/auth.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  feeCalculationSchema,
  estimateCreateSchema,
  idParamsSchema,
  inventoryCreateSchema,
  inventoryListSchema,
  inventoryPatchSchema,
  itemPatchSchema,
  listingCreateSchema,
  listingGenerateSchema,
  listingListSchema,
  listingPatchSchema,
  pricingHistorySchema,
  salesCreateSchema,
  salesListSchema,
  scanSourceSchema,
  scanListSchema,
  analyticsQuerySchema,
  priceGuideSchema,
} from '../validators/schemas.js';
import { createControllers } from '../controllers/index.js';
import { scanUpload } from '../middleware/scan-upload.js';

export function createApiRouter(services: Services, verifier: TokenVerifier): Router {
  const router = Router();
  const controller = createControllers(services);
  router.use(createAuthMiddleware(verifier));

  router.get('/auth/me', controller.me);

  router.get('/inventory', validate('query', inventoryListSchema), controller.listInventory);
  router.post('/inventory', validate('body', inventoryCreateSchema), controller.createInventory);
  router.get('/inventory/:id', validate('params', idParamsSchema), controller.getInventory);
  router.patch('/inventory/:id', validate('params', idParamsSchema), validate('body', inventoryPatchSchema), controller.updateInventory);
  router.delete('/inventory/:id', validate('params', idParamsSchema), controller.deleteInventory);

  router.get('/sales', validate('query', salesListSchema), controller.listSales);
  router.post('/sales', validate('body', salesCreateSchema), controller.createSale);

  router.get('/marketplaces', controller.listMarketplaces);
  router.post('/fees/calculate', validate('body', feeCalculationSchema), controller.calculateFees);
  router.get('/analytics/dashboard', validate('query', analyticsQuerySchema), controller.analyticsDashboard);

  router.get('/scans', validate('query', scanListSchema), controller.listScans);
  router.get('/scans/:id', validate('params', idParamsSchema), controller.getScan);
  router.post('/scans', scanUpload, validate('body', scanSourceSchema), controller.createScan);
  router.post('/scans/:id/retry', validate('params', idParamsSchema), controller.retryScan);
  router.delete('/scans/:id', validate('params', idParamsSchema), controller.deleteScan);

  router.get('/items/:id', validate('params', idParamsSchema), controller.getItem);
  router.patch('/items/:id', validate('params', idParamsSchema), validate('body', itemPatchSchema), controller.updateItem);
  router.post('/items/:id/estimate', validate('params', idParamsSchema), validate('body', estimateCreateSchema), controller.estimateItem);

  router.get('/listings', validate('query', listingListSchema), controller.listListings);
  router.post('/listings/generate', validate('body', listingGenerateSchema), controller.generateListing);
  router.post('/listings', validate('body', listingCreateSchema), controller.createListing);
  router.get('/listings/:id', validate('params', idParamsSchema), controller.getListing);
  router.patch('/listings/:id', validate('params', idParamsSchema), validate('body', listingPatchSchema), controller.updateListing);
  router.delete('/listings/:id', validate('params', idParamsSchema), controller.deleteListing);

  router.get('/pricing/history', validate('query', pricingHistorySchema), controller.pricingHistory);
  router.get('/estimates/:id', validate('params', idParamsSchema), controller.getEstimate);
  router.get('/price-guides', validate('query', priceGuideSchema), controller.listPriceGuides);
  router.get('/analytics/resale-index', controller.notImplemented);

  return router;
}
