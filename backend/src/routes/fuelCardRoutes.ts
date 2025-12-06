import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import * as fuelCardController from '../controllers/fuelCardController';

export const router = Router();

router.use(authMiddleware);

router.get('/', fuelCardController.listFuelCards);
router.post('/', fuelCardController.createFuelCard);
router.get('/:id', fuelCardController.getFuelCardById);
router.put('/:id', fuelCardController.updateFuelCard);
router.delete('/:id', fuelCardController.deleteFuelCard);
router.patch('/:id/assign', fuelCardController.assignFuelCard);
