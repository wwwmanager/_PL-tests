import { Router } from 'express';
import { router as authRoutes } from './authRoutes';
import { router as vehicleRoutes } from './vehicleRoutes';
import { router as waybillRoutes } from './waybillRoutes';
import { router as auditRoutes } from './auditRoutes';
import { router as employeeRoutes } from './employeeRoutes';
import { router as departmentRoutes } from './departmentRoutes';
import { router as blankRoutes } from './blankRoutes';
import { router as organizationRoutes } from './organizationRoutes';
import { router as warehouseRoutes } from './warehouseRoutes';
import { router as fuelTypeRoutes } from './fuelTypeRoutes';
import { router as routeRoutes } from './routeRoutes';
import { router as stockRoutes } from './stockRoutes';
import { router as driverRoutes } from './driverRoutes';

export const router = Router();

router.use('/auth', authRoutes);
router.use('/vehicles', vehicleRoutes);
router.use('/waybills', waybillRoutes);
router.use('/audit', auditRoutes);
router.use('/employees', employeeRoutes);
router.use('/departments', departmentRoutes);
router.use('/blanks', blankRoutes);
router.use('/organizations', organizationRoutes);
router.use('/warehouses', warehouseRoutes);
router.use('/fuel-types', fuelTypeRoutes);
router.use('/routes', routeRoutes);
router.use('/stock', stockRoutes);
router.use('/drivers', driverRoutes);
router.use('/warehouses', warehouseRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
