import { Request, Response, NextFunction } from 'express';
import * as stockLocationService from '../services/stockLocationService';
import { StockLocationType } from '@prisma/client';
import { NotFoundError, BadRequestError } from '../utils/errors';

/**
 * REL-101: Stock Location Controller
 * API для управления локациями хранения топлива
 */

/**
 * GET /stock/locations
 * Получить список локаций организации
 */
export async function listLocations(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const user = req.user as { organizationId: string };

        const filters: stockLocationService.ListLocationsFilter = {};

        // Парсим фильтры из query
        if (req.query.type) {
            const type = String(req.query.type).toUpperCase();
            if (type in StockLocationType) {
                filters.type = type as StockLocationType;
            } else {
                throw new BadRequestError(`Неизвестный тип локации: ${req.query.type}`);
            }
        }

        if (req.query.departmentId) {
            filters.departmentId = String(req.query.departmentId);
        }

        if (req.query.vehicleId) {
            filters.vehicleId = String(req.query.vehicleId);
        }

        if (req.query.fuelCardId) {
            filters.fuelCardId = String(req.query.fuelCardId);
        }

        if (req.query.warehouseId) {
            filters.warehouseId = String(req.query.warehouseId);
        }

        if (req.query.isActive !== undefined) {
            filters.isActive = req.query.isActive === 'true';
        }

        const locations = await stockLocationService.listLocations(
            user.organizationId,
            filters
        );

        res.json(locations);
    } catch (error) {
        next(error);
    }
}

/**
 * GET /stock/locations/:id
 * Получить локацию по ID
 */
export async function getLocationById(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { id } = req.params;

        const location = await stockLocationService.getLocationById(id);

        if (!location) {
            throw new NotFoundError(`Локация ${id} не найдена`);
        }

        // Проверяем принадлежность к организации
        const user = req.user as { organizationId: string };
        if (location.organizationId !== user.organizationId) {
            throw new NotFoundError(`Локация ${id} не найдена`);
        }

        res.json(location);
    } catch (error) {
        next(error);
    }
}

/**
 * POST /stock/locations/warehouse
 * Получить или создать локацию склада
 */
export async function getOrCreateWarehouseLocation(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const user = req.user as { organizationId: string };
        const { departmentId } = req.body;

        const location = await stockLocationService.getOrCreateDefaultWarehouseLocation(
            user.organizationId,
            departmentId || null
        );

        res.json(location);
    } catch (error) {
        next(error);
    }
}

/**
 * POST /stock/locations/vehicle-tank
 * Получить или создать локацию бака ТС
 */
export async function getOrCreateVehicleTankLocation(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { vehicleId } = req.body;

        if (!vehicleId) {
            throw new BadRequestError('vehicleId обязателен');
        }

        const location = await stockLocationService.getOrCreateVehicleTankLocation(vehicleId);

        res.json(location);
    } catch (error) {
        next(error);
    }
}

/**
 * POST /stock/locations/fuel-card
 * Получить или создать локацию топливной карты
 */
export async function getOrCreateFuelCardLocation(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { fuelCardId } = req.body;

        if (!fuelCardId) {
            throw new BadRequestError('fuelCardId обязателен');
        }

        const location = await stockLocationService.getOrCreateFuelCardLocation(fuelCardId);

        res.json(location);
    } catch (error) {
        next(error);
    }
}
