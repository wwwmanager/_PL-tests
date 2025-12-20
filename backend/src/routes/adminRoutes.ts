import { Router, Request, Response, NextFunction } from 'express';
import { resetDatabase, getDataPreview, selectiveDelete, importData, transferUser, transferOrganizationData } from '../controllers/adminController';
import { runRecalculation } from '../controllers/recalculationController';
import { authMiddleware } from '../middleware/authMiddleware';
import { runFuelCardTopUps } from '../jobs/fuelCardTopUpJob';
import { prisma } from '../db/prisma';

const router = Router();

/**
 * Middleware to require a specific role (case-insensitive)
 */
const requireRole = (role: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const userRole = (req as any).user?.role;
        if (!userRole || String(userRole).toLowerCase() !== role.toLowerCase()) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Required role: ${role}`
            });
        }
        next();
    };
};

/**
 * Admin routes - require admin role
 */

// GET /api/admin/data-preview - Get preview of all data by category
router.get('/data-preview', authMiddleware, requireRole('admin'), getDataPreview);

// POST /api/admin/selective-delete - Delete selected data
router.post('/selective-delete', authMiddleware, requireRole('admin'), selectiveDelete);

// POST /api/admin/import - Import JSON data into database
router.post('/import', authMiddleware, requireRole('admin'), importData);

// DELETE /api/admin/reset-database - Reset all data in database
router.delete('/reset-database', authMiddleware, requireRole('admin'), resetDatabase);

// POST /api/admin/transfer-user - Transfer user to different organization
router.post('/transfer-user', authMiddleware, requireRole('admin'), transferUser);

// POST /api/admin/transfer-organization - Transfer all data from one org to another
router.post('/transfer-organization', authMiddleware, requireRole('admin'), transferOrganizationData);

// POST /api/admin/recalculate - Helper for recalculating balances
router.post('/recalculate', authMiddleware, requireRole('admin'), runRecalculation);

// FUEL-OPS-001: POST /api/admin/jobs/run-fuelcard-topups - Manual top-up job execution with audit
router.post('/jobs/run-fuelcard-topups', authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
    const startTime = Date.now();
    const requestId = (req as any).requestId || 'unknown';
    const userId = (req as any).user?.userId;
    const organizationId = (req as any).user?.organizationId;

    try {
        const result = await runFuelCardTopUps();
        const durationMs = Date.now() - startTime;

        // Write audit log for job execution
        try {
            await prisma.auditLog.create({
                data: {
                    organizationId: organizationId || null,
                    userId: userId || null,
                    actionType: 'UPDATE',
                    entityType: 'JOB',
                    entityId: null,
                    description: `Manual FuelCard top-up job executed. Processed: ${result.processed}, Topped up: ${result.toppedUp}, Skipped: ${result.skipped}`,
                    newValue: {
                        jobType: 'FUEL_CARD_TOPUP',
                        requestId,
                        ...result,
                        durationMs,
                    },
                },
            });
        } catch (auditError) {
            // Don't fail the request if audit logging fails
            console.error('[AuditLog] Failed to log job execution:', auditError);
        }

        res.json({
            success: true,
            requestId,
            durationMs,
            ...result,
        });
    } catch (err: any) {
        const durationMs = Date.now() - startTime;

        // Log failed execution
        try {
            await prisma.auditLog.create({
                data: {
                    organizationId: organizationId || null,
                    userId: userId || null,
                    actionType: 'UPDATE',
                    entityType: 'JOB',
                    entityId: null,
                    description: `Manual FuelCard top-up job FAILED: ${err.message}`,
                    newValue: {
                        jobType: 'FUEL_CARD_TOPUP',
                        requestId,
                        error: err.message,
                        durationMs,
                    },
                },
            });
        } catch (auditError) {
            console.error('[AuditLog] Failed to log job error:', auditError);
        }

        res.status(500).json({
            success: false,
            requestId,
            durationMs,
            error: err.message,
        });
    }
});

export default router;

