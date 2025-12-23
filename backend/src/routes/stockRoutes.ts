// Stock Routes - API endpoints for stock items and movements
import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { validateDto } from '../middleware/validateDto';
import { createMovementSchema } from '../dto/stockMovementDto';
import {
    listStockItems, createStockItem, updateStockItem, deleteStockItem,
    listStockMovements, createStockMovement, updateStockMovement, deleteStockMovement,
    getFuelCardBalance, getAvailableFuelExpenses
} from '../controllers/stockController';
import {
    getBalances, getBalance, createMovement, listMovementsV2
} from '../controllers/stockBalanceController';

export const router = Router();

router.use(authMiddleware);

// REL-102: Balance endpoints
router.get('/balances', getBalances);              // GET /api/stock/balances?stockItemId=...&asOf=...
router.get('/balance', getBalance);                // GET /api/stock/balance?locationId=...&stockItemId=...&asOf=...

// Stock Items CRUD
router.get('/items', listStockItems);             // GET /api/stock/items
router.post('/items', createStockItem);           // POST /api/stock/items
router.put('/items/:id', updateStockItem);        // PUT /api/stock/items/:id
router.delete('/items/:id', deleteStockItem);     // DELETE /api/stock/items/:id

// Stock Movements (Transactions) CRUD
router.get('/movements', listStockMovements);     // GET /api/stock/movements
router.post('/movements', createStockMovement);   // POST /api/stock/movements (legacy)
// BE-002: v2 endpoint with Zod DTO validation
router.get('/movements/v2', listMovementsV2);     // GET /api/stock/movements/v2 (STOCK-MOVEMENTS-V2-GET-001)
router.post('/movements/v2', validateDto(createMovementSchema), createMovement);
router.put('/movements/:id', updateStockMovement);// PUT /api/stock/movements/:id
router.delete('/movements/:id', deleteStockMovement); // DELETE /api/stock/movements/:id

// Helper endpoints
router.get('/fuel-card-balance/:driverId', getFuelCardBalance);  // GET /api/stock/fuel-card-balance/:driverId
router.get('/available-fuel-expenses/:driverId', getAvailableFuelExpenses); // GET /api/stock/available-fuel-expenses/:driverId


