import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import * as vehicleSetController from '../controllers/vehicleSetController';

export const router = Router();

router.use(authMiddleware);

router.post('/', vehicleSetController.createSet);
router.put('/:id/equip', vehicleSetController.equipSet);
router.put('/:id/unequip', vehicleSetController.unequipSet);
