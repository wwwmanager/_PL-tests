import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import * as vehicleAssetController from '../controllers/vehicleAssetController';

export const router = Router();

router.use(authMiddleware);

router.post('/', vehicleAssetController.createAsset);
router.delete('/:id', vehicleAssetController.decommissionAsset);
