import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import * as vehicleController from '../controllers/vehicleController';

export const router = Router();

router.use(authMiddleware);

router.get('/', vehicleController.listVehicles);
router.post('/', vehicleController.createVehicle);
router.get('/:id', vehicleController.getVehicleById);
router.put('/:id', vehicleController.updateVehicle);
router.delete('/:id', vehicleController.deleteVehicle);
