import { Request, Response, NextFunction } from 'express';
import * as blankService from '../services/blankService';
import { BlankStatus } from '@prisma/client';

export async function listBatches(req: Request, res: Response, next: NextFunction) {
    try {
        // Admin can see all organizations, others see only their org
        const orgId = req.user!.role === 'admin' ? undefined : req.user!.organizationId;
        const batches = await blankService.listBatches(orgId);
        res.json({ data: batches });
    } catch (err) {
        next(err);
    }
}

export async function createBatch(req: Request, res: Response, next: NextFunction) {
    try {
        console.log('📝 [blankController] createBatch request body:', JSON.stringify(req.body, null, 2));
        console.log('📝 [blankController] req.user:', JSON.stringify(req.user, null, 2));

        // Admin can specify organizationId, otherwise use user's org
        const orgId = req.body.organizationId || req.user!.organizationId;
        console.log('📝 [blankController] Using organizationId:', orgId);

        const userId = req.user!.id;
        const data = req.body;

        const batch = await blankService.createBatch(orgId, userId, data);
        console.log('📝 [blankController] Created batch:', JSON.stringify(batch, null, 2));
        res.status(201).json(batch);
    } catch (err) {
        console.error('❌ [blankController] createBatch error:', err);
        next(err);
    }
}

export async function materializeBatch(req: Request, res: Response, next: NextFunction) {
    try {
        // Admin can materialize any batch, others only their org
        const orgId = req.user!.role === 'admin' ? undefined : req.user!.organizationId;
        const { id } = req.params;

        const result = await blankService.materializeBatch(orgId, id);
        res.json(result);
    } catch (err) {
        next(err);
    }
}

export async function listBlanks(req: Request, res: Response, next: NextFunction) {
    try {
        // Admin can see all organizations, others only their org
        const orgId = req.user!.role === 'admin' ? undefined : req.user!.organizationId;

        // Parse status - frontend sends lowercase, Prisma uses UPPERCASE
        let statusFilter: BlankStatus | undefined;
        if (req.query.status) {
            const statusStr = (req.query.status as string).toUpperCase();
            // Handle comma-separated values (frontend may send 'issued' or 'issued,available')
            const firstStatus = statusStr.split(',')[0] as BlankStatus;
            if (Object.values(BlankStatus).includes(firstStatus)) {
                statusFilter = firstStatus;
            }
        }

        const filters = {
            series: req.query.series as string | undefined,
            status: statusFilter,
            ownerEmployeeId: req.query.ownerEmployeeId as string | undefined,
            page: req.query.page ? Number(req.query.page) : undefined,
            // Support both limit and pageSize (frontend uses pageSize)
            limit: req.query.limit ? Number(req.query.limit) :
                req.query.pageSize ? Number(req.query.pageSize) : 50  // Default 50 for pagination
        };

        const result = await blankService.listBlanks(orgId, filters);
        res.json(result);
    } catch (err) {
        next(err);
    }
}

export async function issueBlank(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = req.user!.organizationId;
        const data = req.body;

        const blank = await blankService.issueBlank(orgId, data);
        res.json(blank);
    } catch (err) {
        next(err);
    }
}

export async function getDriverSummary(req: Request, res: Response, next: NextFunction) {
    try {
        const { driverId } = req.params;
        console.log(`🌐 [blankController] GET /summary/driver/${driverId} request received`);
        const summary = await blankService.getDriverSummary(req.user!.organizationId, driverId);
        res.json(summary);
    } catch (err) {
        console.error(`❌ [blankController] getDriverSummary error for driverId ${req.params.driverId}:`, err);
        next(err);
    }
}

// Issue blanks by range (bulk issue)
export async function issueBlanksRange(req: Request, res: Response, next: NextFunction) {
    try {
        // Admin can issue for any org, others only their org
        const orgId = req.user!.role === 'admin' ? undefined : req.user!.organizationId;
        const { batchId, driverId, numberFrom, numberTo } = req.body;

        console.log('📝 [blankController] issueBlanksRange:', { batchId, driverId, numberFrom, numberTo });

        const result = await blankService.issueBlanksRange(orgId, {
            batchId,
            driverId,
            numberFrom,
            numberTo
        });

        res.json(result);
    } catch (err) {
        console.error('❌ [blankController] issueBlanksRange error:', err);
        next(err);
    }
}

/**
 * REL-501: Get available blanks for a driver
 * GET /blanks/available/:driverId
 * Returns blanks in ISSUED status that can be selected for waybill
 */
export async function getAvailableBlanks(req: Request, res: Response, next: NextFunction) {
    try {
        const { driverId } = req.params;
        console.log(`🎫 [blankController] GET /blanks/available/${driverId} request received`);

        const blanks = await blankService.getAvailableBlanksForDriver(req.user!.organizationId, driverId);
        res.json({ data: blanks });
    } catch (err) {
        console.error(`❌ [blankController] getAvailableBlanks error for driverId ${req.params.driverId}:`, err);
        next(err);
    }
}

/**
 * BLS-REL-001: Release a reserved blank back to ISSUED status
 * POST /blanks/:id/release
 * Used when a waybill creation is cancelled and the blank should be returned to the driver
 */
export async function releaseBlank(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params;
        const orgId = req.user!.organizationId;
        console.log(`🎫 [blankController] POST /blanks/${id}/release request received`);

        const result = await blankService.releaseBlank(orgId, id);
        res.json({ success: true, blank: result });
    } catch (err) {
        console.error(`❌ [blankController] releaseBlank error for blankId ${req.params.id}:`, err);
        next(err);
    }
}
