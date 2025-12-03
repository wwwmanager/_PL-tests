import { Router } from 'express';
import * as fuelTypeController from '../controllers/fuelTypeController';
import { authMiddleware } from '../middleware/authMiddleware';

export const router = Router();

// All fuel type routes require authentication
router.use(authMiddleware);

// GET /api/fuel-types - List all fuel types
router.get('/', fuelTypeController.listFuelTypes);

// GET /api/fuel-types/:id - Get fuel type by ID
router.get('/:id', fuelTypeController.getFuelTypeById);

// POST /api/fuel-types - Create new fuel type
router.post('/', fuelTypeController.createFuelType);

// PUT /api/fuel-types/:id - Update fuel type
router.put('/:id', fuelTypeController.updateFuelType);

// DELETE /api/fuel-types/:id - Delete fuel type
router.delete('/:id', fuelTypeController.deleteFuelType);
