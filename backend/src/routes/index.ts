import { Router } from 'express';
import { router as authRoutes } from './authRoutes';
import { router as vehicleRoutes } from './vehicleRoutes';
import { router as driverRoutes } from './driverRoutes';
import { router as waybillRoutes } from './waybillRoutes';
import { router as auditRoutes } from './auditRoutes';
import { router as employeeRoutes } from './employeeRoutes';
import { router as departmentRoutes } from './departmentRoutes';

export const router = Router();

router.use('/auth', authRoutes);
router.use('/vehicles', vehicleRoutes);
router.use('/drivers', driverRoutes);
router.use('/waybills', waybillRoutes);
router.use('/audit', auditRoutes);
router.use('/employees', employeeRoutes);
router.use('/departments', departmentRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
