import { Request, Response, NextFunction } from 'express';
import * as vehicleAssetService from '../services/vehicleAssetService';
import { CreateAssetInput } from '../services/vehicleAssetService';

export const createAsset = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const input: CreateAssetInput = {
            ...req.body,
            // Ensure dates are parsed
            installedAt: new Date(req.body.installedAt)
        };
        const asset = await vehicleAssetService.createAsset(input);
        res.status(201).json(asset);
    } catch (err) {
        next(err);
    }
};

export const decommissionAsset = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const asset = await vehicleAssetService.decommissionAsset(id);
        res.json(asset);
    } catch (err) {
        next(err);
    }
};
