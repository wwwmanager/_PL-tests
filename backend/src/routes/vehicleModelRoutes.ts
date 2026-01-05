import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import * as vehicleModelController from '../controllers/vehicleModelController';

export const router = Router();

router.use(authMiddleware);

router.get('/', vehicleModelController.listVehicleModels);
router.post('/', vehicleModelController.createVehicleModel);
router.get('/:id', vehicleModelController.getVehicleModelById);
router.put('/:id', vehicleModelController.updateVehicleModel);
router.delete('/:id', vehicleModelController.deleteVehicleModel);
