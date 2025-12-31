import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import * as waybillService from '../services/waybillService';
import {
    createWaybillSchema,
    updateWaybillSchema,
    changeStatusSchema,
    mapLegacyFuelFields
} from '../dto/waybillDto';
import { BadRequestError } from '../utils/errors';


export async function listWaybills(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = req.user!.organizationId;
        const userDepartmentId = req.user!.departmentId;

        // Extract filters from query params
        const filters = {
            startDate: req.query.startDate as string | undefined,
            endDate: req.query.endDate as string | undefined,
            vehicleId: req.query.vehicleId as string | undefined,
            driverId: req.query.driverId as string | undefined,
            status: req.query.status as any,
            // IMPORTANT: If user has departmentId, filter by it (unless they explicitly request another dept)
            // Admin users (no departmentId) can see all departments
            departmentId: userDepartmentId
                ? (req.query.departmentId as string) || userDepartmentId
                : (req.query.departmentId as string) || undefined,
            search: req.query.search as string | undefined,
        };

        // Extract pagination params
        const pagination = {
            page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
            limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        };

        const result = await waybillService.listWaybills(req.user as any, filters, pagination);
        res.json(result);
    } catch (err) {
        next(err);
    }
}

export async function getWaybillById(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = req.user!.organizationId;
        const { id } = req.params;
        const waybill = await waybillService.getWaybillById(req.user as any, id);
        if (!waybill) return res.status(404).json({ error: 'Не найдено' });
        res.json(waybill);
    } catch (err) {
        next(err);
    }
}

export async function createWaybill(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = req.user!.organizationId;

        // Map legacy fuel fields to fuelLines if needed
        mapLegacyFuelFields(req.body);

        const data = req.body;

        console.log('[WB-401] Validated waybill data:', {
            number: data.number,
            date: data.date,
            vehicleId: data.vehicleId,
            driverId: data.driverId,
            fuelLinesCount: data.fuelLines?.length ?? 0,
            isCityDriving: data.isCityDriving,
            isWarming: data.isWarming
        });

        // Create waybill with validated data
        const waybill = await waybillService.createWaybill(req.user as any, data as any);

        console.log('[WB-401] Waybill created:', {
            id: waybill.id,
            number: waybill.number,
            blankId: waybill.blankId
        });

        res.status(201).json(waybill);
    } catch (err) {
        next(err);
    }
}

export async function updateWaybill(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = req.user!.organizationId;
        const { id } = req.params;

        // Map legacy fuel fields to fuelLines if needed
        mapLegacyFuelFields(req.body);

        const data = req.body;

        const waybill = await waybillService.updateWaybill(req.user as any, id, data as any);
        res.json(waybill);
    } catch (err) {
        next(err);
    }
}

export async function deleteWaybill(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = req.user!.organizationId;
        const { id } = req.params;
        await waybillService.deleteWaybill(req.user as any, id);
        res.json({ message: 'Удалено' });
    } catch (err) {
        next(err);
    }
}

export async function bulkDeleteWaybills(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = req.user!.organizationId;
        const { ids } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
            throw new BadRequestError('Не переданы ID для удаления');
        }

        const result = await waybillService.bulkDeleteWaybills(req.user as any, ids);
        res.json(result);
    } catch (err) {
        next(err);
    }
}

/**
 * WB-BULK-POST: Bulk change status for multiple waybills
 */
export async function bulkChangeWaybillStatus(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = req.user!.id;
        const { ids, status, reason } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
            throw new BadRequestError('Не переданы ID путевых листов');
        }

        if (!status) {
            throw new BadRequestError('Не указан целевой статус');
        }

        // WB-BULK-SEQ: Extract stopOnFirstError from body, default true for posting
        const stopOnFirstError = req.body.stopOnFirstError ?? true;

        const result = await waybillService.bulkChangeWaybillStatus(
            req.user as any,
            ids,
            status,
            userId,
            reason,
            stopOnFirstError  // WB-BULK-SEQ: Pass to service
        );

        res.json(result);
    } catch (err) {
        next(err);
    }
}

export async function changeWaybillStatus(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = req.user!.organizationId;
        const userId = req.user!.id;
        const userRole = req.user!.role;
        const { id } = req.params;

        const { status, reason } = req.body;

        // WB-701: Check for override permission
        // Admin and dispatcher can override norm, others cannot
        const hasOverridePermission = ['admin', 'dispatcher'].includes(userRole);

        const waybill = await waybillService.changeWaybillStatus(req.user as any, id, status, userId, hasOverridePermission, reason);
        res.json(waybill);
    } catch (err) {
        next(err);
    }
}
