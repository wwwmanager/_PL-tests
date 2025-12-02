import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import {
    listFuelTypes,
    createFuelType,
    updateFuelType,
    deleteFuelType
} from '../controllers/fuelTypeController';

export const router = Router();

router.use(authMiddleware);

// GET /api/fuel-types - список типов топлива
router.get('/', listFuelTypes);

// POST /api/fuel-types - создать тип топлива
router.post('/', createFuelType);

// PUT /api/fuel-types/:id - обновить тип топлива
router.put('/:id', updateFuelType);

// DELETE /api/fuel-types/:id - удалить тип топлива
router.delete('/:id', deleteFuelType);
