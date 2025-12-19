import { Request, Response, NextFunction } from 'express';
import * as fuelCardService from '../services/fuelCardService';

export async function listFuelCards(req: Request, res: Response, next: NextFunction) {
    try {
        const user = req.user!;
        const fuelCards = await fuelCardService.listFuelCards(user);
        res.json(fuelCards);
    } catch (err) {
        next(err);
    }
}

export async function getFuelCardById(req: Request, res: Response, next: NextFunction) {
    try {
        const user = req.user!;
        const { id } = req.params;
        const fuelCard = await fuelCardService.getFuelCardById(user, id);
        if (!fuelCard) return res.status(404).json({ error: 'Топливная карта не найдена' });
        res.json(fuelCard);
    } catch (err) {
        next(err);
    }
}

export async function createFuelCard(req: Request, res: Response, next: NextFunction) {
    try {
        const user = req.user!;
        const fuelCard = await fuelCardService.createFuelCard(user, req.body);
        res.status(201).json(fuelCard);
    } catch (err) {
        next(err);
    }
}

export async function updateFuelCard(req: Request, res: Response, next: NextFunction) {
    try {
        const user = req.user!;
        const { id } = req.params;
        const fuelCard = await fuelCardService.updateFuelCard(user, id, req.body);
        res.json(fuelCard);
    } catch (err) {
        next(err);
    }
}

export async function deleteFuelCard(req: Request, res: Response, next: NextFunction) {
    try {
        const user = req.user!;
        const { id } = req.params;
        await fuelCardService.deleteFuelCard(user, id);
        res.status(204).send();
    } catch (err) {
        next(err);
    }
}

export async function assignFuelCard(req: Request, res: Response, next: NextFunction) {
    try {
        const user = req.user!;
        const { id } = req.params;
        const { driverId, vehicleId } = req.body as { driverId?: string; vehicleId?: string };
        const fuelCard = await fuelCardService.assignFuelCard(user, id, driverId, vehicleId);
        res.json(fuelCard);
    } catch (err) {
        next(err);
    }
}

/**
 * REL-601: Get fuel cards for a specific driver
 */
export async function getFuelCardsForDriver(req: Request, res: Response, next: NextFunction) {
    try {
        const { driverId } = req.params;
        const fuelCards = await fuelCardService.getFuelCardsForDriver(req.user!.organizationId, driverId);
        res.json({ data: fuelCards });
    } catch (err) {
        next(err);
    }
}
