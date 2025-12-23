// Driver Routes - API endpoints for drivers
import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { listDrivers, getDriverById, searchDrivers } from '../controllers/driverController';

export const router = Router();

router.use(authMiddleware);

router.get('/', listDrivers);           // GET /api/drivers
// FUEL-CARD-LINK-UI: Search drivers by name (must be before /:id)
router.get('/search', searchDrivers);   // GET /api/drivers/search?q=...
router.get('/:id', getDriverById);      // GET /api/drivers/:id
