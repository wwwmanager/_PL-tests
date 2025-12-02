// Stock Routes - API endpoints for stock items and movements
import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { listStockItems, listStockMovements } from '../controllers/stockController';

export const router = Router();

router.use(authMiddleware);

router.get('/items', listStockItems);           // GET /api/stock/items
router.get('/movements', listStockMovements);   // GET /api/stock/movements
