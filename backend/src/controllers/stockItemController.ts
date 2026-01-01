/**
 * REL-200: StockItem (Nomenclature) Controller
 * REST API endpoints for stock items catalog
 */

import { Request, Response, NextFunction } from 'express';
import * as stockItemService from '../services/stockItemService';
import { BadRequestError } from '../utils/errors';

/**
 * GET /stock-items
 * List all stock items for organization
 */
export async function getAll(req: Request, res: Response, next: NextFunction) {
    try {
        const user = req.user as { organizationId: string; role?: string };
        const { category, isFuel, isActive, search } = req.query;

        const items = await stockItemService.getAll({
            organizationId: user.organizationId,
            category: category as string,
            isFuel: isFuel === 'true' ? true : isFuel === 'false' ? false : undefined,
            isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
            search: search as string,
        });

        // RLS-STOCK-010: Drivers get read-only access
        const isDriver = user.role === 'driver';
        const itemsWithAccess = items.map((item: any) => ({
            ...item,
            _canEdit: !isDriver  // Drivers cannot edit
        }));

        res.json({ data: itemsWithAccess });
    } catch (error) {
        next(error);
    }
}

/**
 * GET /stock-items/:id
 * Get single stock item by ID
 */
export async function getById(req: Request, res: Response, next: NextFunction) {
    try {
        const user = req.user as { organizationId: string };
        const { id } = req.params;

        const item = await stockItemService.getById(id, user.organizationId);
        if (!item) {
            throw new BadRequestError('Номенклатура не найдена');
        }

        res.json(item);
    } catch (error) {
        next(error);
    }
}

/**
 * POST /stock-items
 * Create new stock item
 */
export async function create(req: Request, res: Response, next: NextFunction) {
    try {
        const user = req.user as { organizationId: string };
        const { code, name, unit, isFuel, density, category, fuelTypeLegacyId } = req.body;

        if (!name) {
            throw new BadRequestError('Название обязательно');
        }

        const item = await stockItemService.create({
            organizationId: user.organizationId,
            code,
            name,
            unit,
            isFuel,
            density,
            category,
            fuelTypeLegacyId,
        });

        res.status(201).json(item);
    } catch (error) {
        next(error);
    }
}

/**
 * PUT /stock-items/:id
 * Update stock item
 */
export async function update(req: Request, res: Response, next: NextFunction) {
    try {
        const user = req.user as { organizationId: string };
        const { id } = req.params;
        const { code, name, unit, isFuel, density, category, isActive } = req.body;

        const item = await stockItemService.update(id, user.organizationId, {
            code,
            name,
            unit,
            isFuel,
            density,
            category,
            isActive,
        });

        if (!item) {
            throw new BadRequestError('Номенклатура не найдена');
        }

        res.json(item);
    } catch (error) {
        next(error);
    }
}

/**
 * DELETE /stock-items/:id
 * Soft-delete stock item
 */
export async function remove(req: Request, res: Response, next: NextFunction) {
    try {
        const user = req.user as { organizationId: string };
        const { id } = req.params;

        await stockItemService.softDelete(id, user.organizationId);

        res.json({ success: true });
    } catch (error) {
        next(error);
    }
}
