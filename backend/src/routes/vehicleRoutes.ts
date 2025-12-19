import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import * as vehicleController from '../controllers/vehicleController';
import { validateDto } from '../middleware/validateDto';
import { vehicleSchema } from '../dto/vehicleDto';

export const router = Router();

router.use(authMiddleware);

router.get('/', vehicleController.listVehicles);
router.post('/', validateDto(vehicleSchema), vehicleController.createVehicle);
router.get('/:id', vehicleController.getVehicleById);
router.put('/:id', validateDto(vehicleSchema), vehicleController.updateVehicle);
router.delete('/:id', vehicleController.deleteVehicle);
