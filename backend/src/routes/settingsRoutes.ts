import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import * as settingsController from '../controllers/settingsController';

export const router = Router();

router.use(authMiddleware);

// App Settings
router.get('/app', settingsController.getAppSettings);
router.put('/app', settingsController.saveAppSettings);

// Season Settings
router.get('/season', settingsController.getSeasonSettings);
router.put('/season', settingsController.saveSeasonSettings);
