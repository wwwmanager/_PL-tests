// Audit Controller - Handle audit log requests
import { Request, Response, NextFunction } from 'express';
import * as auditService from '../services/auditService';
import { AuditActionType } from '@prisma/client';

export async function getAuditLogs(req: Request, res: Response, next: NextFunction) {
    try {
        const {
            userId,
            action,
            entityType,
            entityId,
            startDate,
            endDate,
            page,
            limit,
        } = req.query;

        const filters: auditService.AuditLogFilters = {
            userId: userId as string,
            action: action as AuditActionType,
            entityType: entityType as string,
            entityId: entityId as string,
            startDate: startDate ? new Date(startDate as string) : undefined,
            endDate: endDate ? new Date(endDate as string) : undefined,
            page: page ? parseInt(page as string) : undefined,
            limit: limit ? parseInt(limit as string) : undefined,
        };

        const result = await auditService.getAuditLogs(filters);

        res.json({
            success: true,
            data: result,
        });
    } catch (err) {
        next(err);
    }
}

export async function getAuditLogById(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params;

        const log = await auditService.getAuditLogById(id);

        if (!log) {
            return res.status(404).json({
                success: false,
                error: 'Audit log not found',
            });
        }

        res.json({
            success: true,
            data: { log },
        });
    } catch (err) {
        next(err);
    }
}

export async function getAuditLogStats(req: Request, res: Response, next: NextFunction) {
    try {
        const stats = await auditService.getAuditLogStats();

        res.json({
            success: true,
            data: stats,
        });
    } catch (err) {
        next(err);
    }
}
