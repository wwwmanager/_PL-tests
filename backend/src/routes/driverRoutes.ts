import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import * as driverController from '../controllers/driverController';

export const router = Router();

router.use(authMiddleware);

router.get('/', driverController.listDrivers);
router.post('/', driverController.createDriver);
router.get('/:id', driverController.getDriverById);
router.put('/:id', driverController.updateDriver);
router.delete('/:id', driverController.deleteDriver);
