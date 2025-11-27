import { Request, Response, NextFunction } from 'express';
import * as vehicleService from '../services/vehicleService';

export async function listVehicles(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = req.user!.organizationId;
        const vehicles = await vehicleService.listVehicles(orgId);
        res.json(vehicles);
    } catch (err) {
        next(err);
    }
}

export async function getVehicleById(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = req.user!.organizationId;
        const { id } = req.params;
        const vehicle = await vehicleService.getVehicleById(orgId, id);
        if (!vehicle) return res.status(404).json({ error: 'Не найдено' });
        res.json(vehicle);
    } catch (err) {
        next(err);
    }
}

export async function createVehicle(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = req.user!.organizationId;
        const data = req.body;
        const vehicle = await vehicleService.createVehicle(orgId, data);
        res.status(201).json(vehicle);
    } catch (err) {
        next(err);
    }
}

export async function updateVehicle(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = req.user!.organizationId;
        const { id } = req.params;
        const data = req.body;
        await vehicleService.updateVehicle(orgId, id, data);
        res.json({ message: 'Обновлено' });
    } catch (err) {
        next(err);
    }
}

export async function deleteVehicle(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = req.user!.organizationId;
        const { id } = req.params;
        await vehicleService.deleteVehicle(orgId, id);
        res.json({ message: 'Удалено' });
    } catch (err) {
        next(err);
    }
}
