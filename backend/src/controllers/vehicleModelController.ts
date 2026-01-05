import { Request, Response, NextFunction } from 'express';
import * as vehicleModelService from '../services/vehicleModelService';

export async function listVehicleModels(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = (req as any).user!.organizationId;
        const models = await vehicleModelService.listVehicleModels(orgId);
        res.json(models);
    } catch (err) {
        next(err);
    }
}

export async function getVehicleModelById(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = (req as any).user!.organizationId;
        const { id } = req.params;
        const model = await vehicleModelService.getVehicleModelById(orgId, id);
        if (!model) return res.status(404).json({ error: 'Не найдено' });
        res.json(model);
    } catch (err) {
        next(err);
    }
}

export async function createVehicleModel(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = (req as any).user!.organizationId;
        const model = await vehicleModelService.createVehicleModel(orgId, req.body);
        res.status(201).json(model);
    } catch (err) {
        next(err);
    }
}

export async function updateVehicleModel(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = (req as any).user!.organizationId;
        const { id } = req.params;
        const model = await vehicleModelService.updateVehicleModel(orgId, id, req.body);
        res.json(model);
    } catch (err) {
        next(err);
    }
}

export async function deleteVehicleModel(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = (req as any).user!.organizationId;
        const { id } = req.params;
        await vehicleModelService.deleteVehicleModel(orgId, id);
        res.json({ message: 'Удалено' });
    } catch (err) {
        next(err);
    }
}
