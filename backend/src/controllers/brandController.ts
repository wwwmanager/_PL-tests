import { Request, Response, NextFunction } from 'express';
import * as brandService from '../services/brandService';

export async function getAll(req: Request, res: Response, next: NextFunction) {
    try {
        const user = req.user as { organizationId: string };
        const brands = await brandService.getAll(user.organizationId);
        res.json(brands);
    } catch (error) {
        next(error);
    }
}

export async function create(req: Request, res: Response, next: NextFunction) {
    try {
        const user = req.user as { organizationId: string };
        const { name } = req.body;
        const brand = await brandService.create(user.organizationId, name);
        res.status(201).json(brand);
    } catch (error) {
        next(error);
    }
}
