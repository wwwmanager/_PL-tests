import { Request, Response, NextFunction } from 'express';
import * as fuelTypeService from '../services/fuelTypeService';

/**
 * List all fuel types
 */
export async function listFuelTypes(req: Request, res: Response, next: NextFunction) {
    try {
        const fuelTypes = await fuelTypeService.listFuelTypes();
        res.json({ data: fuelTypes });
    } catch (err) {
        next(err);
    }
}

/**
 * Get fuel type by ID
 */
export async function getFuelTypeById(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params;

        const fuelType = await fuelTypeService.getFuelTypeById(id);

        if (!fuelType) {
            return res.status(404).json({ error: 'Fuel type not found' });
        }

        res.json({ data: fuelType });
    } catch (err) {
        next(err);
    }
}

/**
 * Create new fuel type
 */
export async function createFuelType(req: Request, res: Response, next: NextFunction) {
    try {
        const { code, name, density } = req.body;

        const fuelType = await fuelTypeService.createFuelType({
            code,
            name,
            density: density != null ? parseFloat(density) : null
        });

        res.status(201).json({ data: fuelType });
    } catch (err) {
        next(err);
    }
}

/**
 * Update fuel type
 */
export async function updateFuelType(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params;
        const { code, name, density } = req.body;

        const fuelType = await fuelTypeService.updateFuelType(id, {
            code,
            name,
            density: density != null ? parseFloat(density) : null
        });

        res.json({ data: fuelType });
    } catch (err) {
        next(err);
    }
}

/**
 * Delete fuel type
 */
export async function deleteFuelType(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params;

        await fuelTypeService.deleteFuelType(id);

        res.json({ message: 'Fuel type deleted successfully' });
    } catch (err) {
        next(err);
    }
}
