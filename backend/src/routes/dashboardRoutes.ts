import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import * as dashboardController from '../controllers/dashboardController';

export const router = Router();

router.use(authMiddleware);

// GET /api/dashboard/stats - Main dashboard statistics
router.get('/stats', dashboardController.getStats);

// GET /api/dashboard/issues - Expiring documents list
router.get('/issues', dashboardController.getIssues);
