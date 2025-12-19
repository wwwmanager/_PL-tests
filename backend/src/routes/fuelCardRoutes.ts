import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import * as fuelCardController from '../controllers/fuelCardController';

export const router = Router();

router.use(authMiddleware);

router.get('/', fuelCardController.listFuelCards);
router.post('/', fuelCardController.createFuelCard);

// REL-601: Get fuel cards for specific driver (must be before /:id to avoid conflict)
router.get('/driver/:driverId', fuelCardController.getFuelCardsForDriver);

router.get('/:id', fuelCardController.getFuelCardById);
router.put('/:id', fuelCardController.updateFuelCard);
router.delete('/:id', fuelCardController.deleteFuelCard);
router.patch('/:id/assign', fuelCardController.assignFuelCard);
