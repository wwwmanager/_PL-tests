import { Router } from 'express';
import * as stockLocationController from '../controllers/stockLocationController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

/**
 * REL-101: Stock Location Routes
 * API для управления локациями хранения топлива
 * 
 * GET  /stock/locations              - список локаций (с фильтрами)
 * GET  /stock/locations/:id          - получить локацию по ID
 * POST /stock/locations/warehouse    - получить/создать локацию склада
 * POST /stock/locations/vehicle-tank - получить/создать локацию бака ТС
 * POST /stock/locations/fuel-card    - получить/создать локацию топливной карты
 */

// Все маршруты требуют авторизации
router.use(authMiddleware);

// GET /stock/locations
router.get('/', stockLocationController.listLocations);

// GET /stock/locations/:id
router.get('/:id', stockLocationController.getLocationById);

// POST /stock/locations/warehouse
router.post('/warehouse', stockLocationController.getOrCreateWarehouseLocation);

// POST /stock/locations/vehicle-tank
router.post('/vehicle-tank', stockLocationController.getOrCreateVehicleTankLocation);

// POST /stock/locations/fuel-card
router.post('/fuel-card', stockLocationController.getOrCreateFuelCardLocation);

export default router;
