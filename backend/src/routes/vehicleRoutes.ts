import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import * as vehicleController from '../controllers/vehicleController';
import { validateDto } from '../middleware/validateDto';
import { vehicleSchema } from '../dto/vehicleDto';
import * as vehicleSetService from '../services/vehicleSetService';
import * as vehicleAssetService from '../services/vehicleAssetService';

export const router = Router();

router.use(authMiddleware);

router.get('/', vehicleController.listVehicles);
router.post('/', validateDto(vehicleSchema), vehicleController.createVehicle);
router.get('/:id', vehicleController.getVehicleById);
router.put('/:id', validateDto(vehicleSchema), vehicleController.updateVehicle);
router.delete('/:id', vehicleController.deleteVehicle);

// Vehicle Sets (Tires/Wheels)
router.get('/:id/sets', async (req, res, next) => {
    try {
        const sets = await vehicleSetService.getSetsByVehicle(req.params.id);
        res.json(sets);
    } catch (err) {
        next(err);
    }
});

// Vehicle Assets (Batteries, Aggregates)
router.get('/:id/assets', async (req, res, next) => {
    try {
        const assets = await vehicleAssetService.getAssetsByVehicle(req.params.id);
        res.json(assets);
    } catch (err) {
        next(err);
    }
});
