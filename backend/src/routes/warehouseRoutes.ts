import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import {
    listWarehouses,
    createWarehouse,
    updateWarehouse,
    deleteWarehouse
} from '../controllers/warehouseController';

export const router = Router();

router.use(authMiddleware);

// GET /api/warehouses - список складов
router.get('/', listWarehouses);

// POST /api/warehouses - создать склад
router.post('/', createWarehouse);

// PUT /api/warehouses/:id - обновить склад
router.put('/:id', updateWarehouse);

// DELETE /api/warehouses/:id - удалить склад
router.delete('/:id', deleteWarehouse);
