import { Request, Response, NextFunction } from 'express';
import * as dashboardService from '../services/dashboardService';

export async function getStats(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = req.user!.organizationId;
        const { vehicleId, dateFrom, dateTo } = req.query;

        const stats = await dashboardService.getDashboardStats({
            organizationId: orgId,
            vehicleId: vehicleId as string | undefined,
            dateFrom: dateFrom as string | undefined,
            dateTo: dateTo as string | undefined
        });

        res.json({ success: true, data: stats });
    } catch (err) {
        next(err);
    }
}

export async function getIssues(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = req.user!.organizationId;
        const { vehicleId } = req.query;

        const expiringDocs = await dashboardService.getExpiringDocs(orgId, vehicleId as string | undefined);

        res.json({ success: true, data: { expiringDocs } });
    } catch (err) {
        next(err);
    }
}
