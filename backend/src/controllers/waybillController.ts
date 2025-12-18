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

/**
 * Format Zod validation errors for API response
 */
function formatZodError(error: ZodError): string {
    return error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ');
}

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

        // Validate input with Zod
        const parseResult = createWaybillSchema.safeParse(req.body);
        if (!parseResult.success) {
            throw new BadRequestError(formatZodError(parseResult.error));
        }

        const data = parseResult.data;

        // Map legacy fuel fields to fuelLines if needed
        mapLegacyFuelFields(data);

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

        // Validate input with Zod
        const parseResult = updateWaybillSchema.safeParse(req.body);
        if (!parseResult.success) {
            throw new BadRequestError(formatZodError(parseResult.error));
        }

        const data = parseResult.data;

        // Map legacy fuel fields to fuelLines if needed
        mapLegacyFuelFields(data);

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

export async function changeWaybillStatus(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = req.user!.organizationId;
        const userId = req.user!.id;
        const userRole = req.user!.role;
        const { id } = req.params;

        // Validate status input
        const parseResult = changeStatusSchema.safeParse(req.body);
        if (!parseResult.success) {
            throw new BadRequestError(formatZodError(parseResult.error));
        }

        const { status } = parseResult.data;

        // WB-701: Check for override permission
        // Admin and dispatcher can override norm, others cannot
        const hasOverridePermission = ['admin', 'dispatcher'].includes(userRole);

        const waybill = await waybillService.changeWaybillStatus(req.user as any, id, status, userId, hasOverridePermission);
        res.json(waybill);
    } catch (err) {
        next(err);
    }
}
