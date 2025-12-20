// Stock Routes - API endpoints for stock items and movements
import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import {
    listStockItems, createStockItem, updateStockItem, deleteStockItem,
    listStockMovements, createStockMovement, updateStockMovement, deleteStockMovement,
    getFuelCardBalance, getAvailableFuelExpenses
} from '../controllers/stockController';
import {
    getBalances, getBalance, createMovement
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
router.post('/movements/v2', createMovement);     // POST /api/stock/movements/v2 (REL-102: supports TRANSFER)
router.put('/movements/:id', updateStockMovement);// PUT /api/stock/movements/:id
router.delete('/movements/:id', deleteStockMovement); // DELETE /api/stock/movements/:id

// Helper endpoints
router.get('/fuel-card-balance/:driverId', getFuelCardBalance);  // GET /api/stock/fuel-card-balance/:driverId
router.get('/available-fuel-expenses/:driverId', getAvailableFuelExpenses); // GET /api/stock/available-fuel-expenses/:driverId

