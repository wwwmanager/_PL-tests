import { Router } from 'express';
import * as warehouseController from '../controllers/warehouseController';
import { authMiddleware } from '../middleware/authMiddleware';

export const router = Router();

// All warehouse routes require authentication
router.use(authMiddleware);

// GET /api/warehouses - List all warehouses
router.get('/', warehouseController.listWarehouses);

// GET /api/warehouses/:id - Get warehouse by ID
router.get('/:id', warehouseController.getWarehouseById);

// POST /api/warehouses - Create new warehouse
router.post('/', warehouseController.createWarehouse);

// PUT /api/warehouses/:id - Update warehouse
router.put('/:id', warehouseController.updateWarehouse);

// DELETE /api/warehouses/:id - Delete warehouse
router.delete('/:id', warehouseController.deleteWarehouse);

