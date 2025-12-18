import { Router } from 'express';
import * as auditController from '../controllers/auditController';
import { authMiddleware } from '../middleware/authMiddleware';

export const router = Router();

// All audit routes require authentication
// TODO: Add admin role check when RBAC is implemented

router.get('/logs', authMiddleware, auditController.getAuditLogs);
router.get('/logs/:id', authMiddleware, auditController.getAuditLogById);
router.get('/stats', authMiddleware, auditController.getAuditLogStats);
