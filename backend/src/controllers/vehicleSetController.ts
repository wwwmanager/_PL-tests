import { Request, Response, NextFunction } from 'express';
import * as vehicleSetService from '../services/vehicleSetService';
import { CreateSetInput } from '../services/vehicleSetService';

export const createSet = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const input: CreateSetInput = req.body;
        const set = await vehicleSetService.createSet(input);
        res.status(201).json(set);
    } catch (err) {
        next(err);
    }
};

export const equipSet = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { vehicleId, currentOdometer } = req.body;
        const set = await vehicleSetService.equipSet(id, vehicleId, currentOdometer);
        res.json(set);
    } catch (err) {
        next(err);
    }
};

export const unequipSet = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { locationId, currentOdometer } = req.body;
        const set = await vehicleSetService.unequipSet(id, locationId, currentOdometer);
        res.json(set);
    } catch (err) {
        next(err);
    }
};
