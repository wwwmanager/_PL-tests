import { Request, Response, NextFunction } from 'express';
import * as driverService from '../services/driverService';

export async function listDrivers(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = req.user!.organizationId;
        const drivers = await driverService.listDrivers(orgId);
        res.json(drivers);
    } catch (err) {
        next(err);
    }
}

export async function getDriverById(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = req.user!.organizationId;
        const { id } = req.params;
        const driver = await driverService.getDriverById(orgId, id);
        if (!driver) return res.status(404).json({ error: 'Не найдено' });
        res.json(driver);
    } catch (err) {
        next(err);
    }
}

export async function createDriver(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = req.user!.organizationId;
        const data = req.body;
        const driver = await driverService.createDriver(orgId, data);
        res.status(201).json(driver);
    } catch (err) {
        next(err);
    }
}

export async function updateDriver(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = req.user!.organizationId;
        const { id } = req.params;
        const data = req.body;
        const driver = await driverService.updateDriver(orgId, id, data);
        if (!driver) return res.status(404).json({ error: 'Не найдено' });
        res.json(driver);
    } catch (err) {
        next(err);
    }
}

export async function deleteDriver(req: Request, res: Response, next: NextFunction) {
    try {
        const orgId = req.user!.organizationId;
        const { id } = req.params;
        const result = await driverService.deleteDriver(orgId, id);
        if (!result) return res.status(404).json({ error: 'Не найдено' });
        res.json({ message: 'Удалено' });
    } catch (err) {
        next(err);
    }
}
