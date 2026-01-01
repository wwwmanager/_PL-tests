// Driver Routes - API endpoints for drivers
import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { listDrivers, getDriverById, searchDrivers } from '../controllers/driverController';
import { getDriverSelf } from '../controllers/driverSelfController';

export const router = Router();

router.use(authMiddleware);

// DRIVER-SELF-BE-010: Driver self-scope endpoint (must be before /:id)
router.get('/self', getDriverSelf);         // GET /api/drivers/self
router.get('/', listDrivers);               // GET /api/drivers
// FUEL-CARD-LINK-UI: Search drivers by name (must be before /:id)
router.get('/search', searchDrivers);       // GET /api/drivers/search?q=...
router.get('/:id', getDriverById);          // GET /api/drivers/:id

