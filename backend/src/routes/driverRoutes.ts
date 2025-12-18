// Driver Routes - API endpoints for drivers
import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { listDrivers, getDriverById } from '../controllers/driverController';

export const router = Router();

router.use(authMiddleware);

router.get('/', listDrivers);           // GET /api/drivers
router.get('/:id', getDriverById);      // GET /api/drivers/:id
