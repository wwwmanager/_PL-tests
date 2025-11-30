import { Request, Response, NextFunction } from 'express';
import * as waybillService from '../services/waybillService';
import { WaybillStatus } from '../entities/enums';

export async function listWaybills(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = req.user!.organizationId;
        const filters = {
            startDate: req.query.startDate as string | undefined,
            endDate: req.query.endDate as string | undefined,
            vehicleId: req.query.vehicleId as string | undefined,
            driverId: req.query.driverId as string | undefined,
            status: req.query.status as WaybillStatus | undefined
        };
        const waybills = await waybillService.listWaybills(orgId, filters);
        res.json(waybills);
    } catch (err) {
        next(err);
    }
}

export async function getWaybillById(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = req.user!.organizationId;
        const { id } = req.params;
        const waybill = await waybillService.getWaybillById(orgId, id);
        if (!waybill) return res.status(404).json({ error: 'Не найдено' });
        res.json(waybill);
    } catch (err) {
        next(err);
    }
}

export async function createWaybill(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = req.user!.organizationId;
        const data = req.body;

        // 🔍 DEBUG: Log incoming request
        console.log('\n📥 POST /api/waybills - Request received');
        console.log('  👤 User:', {
            id: req.user!.id,
            organizationId: req.user!.organizationId,
            role: req.user!.role
        });
        console.log('  📦 Body:', JSON.stringify(data, null, 2));

        // Create waybill
        console.log('🔄 Creating waybill...');
        const waybill = await waybillService.createWaybill(orgId, data);

        if (waybill) {
            console.log('✅ Waybill created successfully:', {
                id: waybill.id,
                number: waybill.number,
                blankId: waybill.blankId
            });
        }

        res.status(201).json(waybill);
    } catch (err) {
        console.error('❌ Error creating waybill:', err);
        next(err);
    }
}

export async function updateWaybill(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = req.user!.organizationId;
        const { id } = req.params;
        const data = req.body;
        const waybill = await waybillService.updateWaybill(orgId, id, data);
        res.json(waybill);
    } catch (err) {
        next(err);
    }
}

export async function deleteWaybill(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = req.user!.organizationId;
        const { id } = req.params;
        await waybillService.deleteWaybill(orgId, id);
        res.json({ message: 'Удалено' });
    } catch (err) {
        next(err);
    }
}

export async function changeWaybillStatus(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = req.user!.organizationId;
        const { id } = req.params;
        const { status } = req.body;
        const waybill = await waybillService.changeWaybillStatus(orgId, id, status);
        res.json(waybill);
    } catch (err) {
        next(err);
    }
}
