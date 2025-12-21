/**
 * REL-200: StockItem (Nomenclature) Routes
 */

import { Router } from 'express';
import * as stockItemController from '../controllers/stockItemController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/stock-items - List all stock items
router.get('/', stockItemController.getAll);

// GET /api/stock-items/:id - Get single stock item
router.get('/:id', stockItemController.getById);

// POST /api/stock-items - Create new stock item
router.post('/', stockItemController.create);

// PUT /api/stock-items/:id - Update stock item
router.put('/:id', stockItemController.update);

// DELETE /api/stock-items/:id - Soft-delete stock item
router.delete('/:id', stockItemController.remove);

export default router;
