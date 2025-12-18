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
        const filters = {
            series: req.query.series as string | undefined,
            status: req.query.status as BlankStatus | undefined,
            page: req.query.page ? Number(req.query.page) : undefined,
            // Support both limit and pageSize (frontend uses pageSize)
            limit: req.query.limit ? Number(req.query.limit) :
                req.query.pageSize ? Number(req.query.pageSize) : 1000  // Default 1000 for admin panel
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
        const summary = await blankService.getDriverSummary(driverId);
        res.json(summary);
    } catch (err) {
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


