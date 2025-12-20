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
import { router as fuelCardRoutes } from './fuelCardRoutes';
import { router as userRoutes } from './userRoutes';
import { router as roleRoutes } from './roleRoutes';
import { router as settingsRoutes } from './settingsRoutes';
import { router as dashboardRoutes } from './dashboardRoutes';
import adminRoutes from './adminRoutes';
import { calendarRouter } from './calendarRoutes';
import { router as meRoutes } from './meRoutes';
import stockLocationRoutes from './stockLocationRoutes';

export const router = Router();

// REL-001: /me endpoint for user context
router.use('/me', meRoutes);

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
router.use('/stock/locations', stockLocationRoutes);  // REL-101: Stock Locations
router.use('/drivers', driverRoutes);
router.use('/fuel-cards', fuelCardRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/settings', settingsRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/admin', adminRoutes);
router.use('/calendar', calendarRouter);

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});


