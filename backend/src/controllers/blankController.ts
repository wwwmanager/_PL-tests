import { Request, Response, NextFunction } from 'express';
import * as blankService from '../services/blankService';
import { BlankStatus } from '@prisma/client';

export async function createBatch(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = req.user!.organizationId;
        const userId = req.user!.id;
        const data = req.body;

        const batch = await blankService.createBatch(orgId, userId, data);
        res.status(201).json(batch);
    } catch (err) {
        next(err);
    }
}

export async function materializeBatch(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = req.user!.organizationId;
        const { id } = req.params;

        const result = await blankService.materializeBatch(orgId, id);
        res.json(result);
    } catch (err) {
        next(err);
    }
}

export async function listBlanks(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = req.user!.organizationId;
        const filters = {
            series: req.query.series as string | undefined,
            status: req.query.status as BlankStatus | undefined,
            page: req.query.page ? Number(req.query.page) : undefined,
            limit: req.query.limit ? Number(req.query.limit) : undefined
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

