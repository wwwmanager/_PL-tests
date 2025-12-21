/**
 * MIG-FT-002: FuelType Controller - Deprecated
 * 
 * GET endpoints return StockItem(category=FUEL) as FuelType format.
 * POST/PUT/DELETE endpoints return 410 Gone.
 */
import { Request, Response, NextFunction } from 'express';
import { StockItemCategory } from '@prisma/client';
import { logger } from '../utils/logger';
import * as stockItemService from '../services/stockItemService';

/**
 * List all fuel types (alias to StockItem category=FUEL)
 * @deprecated MIG-FT-002: Use GET /api/stock-items?categoryEnum=FUEL instead
 */
export async function listFuelTypes(req: Request, res: Response, next: NextFunction) {
    try {
        logger.warn('[DEPRECATED] GET /api/fuel-types called - use GET /api/stock-items?categoryEnum=FUEL');

        // Get StockItems with category FUEL and map to FuelType format
        const orgId = (req as any).user?.organizationId;
        const stockItems = await stockItemService.getAll({
            organizationId: orgId,
            categoryEnum: StockItemCategory.FUEL,
            isActive: true
        });

        // Map to FuelType DTO format for backward compatibility
        const fuelTypes = stockItems.map(item => ({
            id: item.id,
            code: item.code || '',
            name: item.name,
            density: item.density,
            // Legacy fields
            _stockItemId: item.id, // For mapping reference
        }));

        res.json({ data: fuelTypes });
    } catch (err) {
        next(err);
    }
}

/**
 * Get fuel type by ID (alias to StockItem)
 * @deprecated MIG-FT-002: Use GET /api/stock-items/:id instead
 */
export async function getFuelTypeById(req: Request, res: Response, next: NextFunction) {
    try {
        logger.warn('[DEPRECATED] GET /api/fuel-types/:id called - use GET /api/stock-items/:id');

        const { id } = req.params;
        const orgId = (req as any).user?.organizationId;

        const stockItem = await stockItemService.getById(id, orgId);

        if (!stockItem || stockItem.categoryEnum !== StockItemCategory.FUEL) {
            return res.status(404).json({ error: 'Fuel type not found' });
        }

        // Map to FuelType DTO format
        const fuelType = {
            id: stockItem.id,
            code: stockItem.code || '',
            name: stockItem.name,
            density: stockItem.density,
            _stockItemId: stockItem.id,
        };

        res.json({ data: fuelType });
    } catch (err) {
        next(err);
    }
}

/**
 * Create new fuel type - DISABLED
 * @deprecated MIG-FT-002: Use POST /api/stock-items with categoryEnum=FUEL instead
 */
export async function createFuelType(req: Request, res: Response, next: NextFunction) {
    logger.warn('[DEPRECATED] POST /api/fuel-types called - endpoint disabled');

    res.status(410).json({
        error: 'Gone',
        message: 'FuelType creation is deprecated. Use POST /api/stock-items with categoryEnum=FUEL instead.',
        deprecated: true,
        migration: 'MIG-FT-002'
    });
}

/**
 * Update fuel type - DISABLED
 * @deprecated MIG-FT-002: Use PUT /api/stock-items/:id instead
 */
export async function updateFuelType(req: Request, res: Response, next: NextFunction) {
    logger.warn('[DEPRECATED] PUT /api/fuel-types/:id called - endpoint disabled');

    res.status(410).json({
        error: 'Gone',
        message: 'FuelType update is deprecated. Use PUT /api/stock-items/:id instead.',
        deprecated: true,
        migration: 'MIG-FT-002'
    });
}

/**
 * Delete fuel type - DISABLED
 * @deprecated MIG-FT-002: Use DELETE /api/stock-items/:id instead
 */
export async function deleteFuelType(req: Request, res: Response, next: NextFunction) {
    logger.warn('[DEPRECATED] DELETE /api/fuel-types/:id called - endpoint disabled');

    res.status(410).json({
        error: 'Gone',
        message: 'FuelType deletion is deprecated. Use DELETE /api/stock-items/:id instead.',
        deprecated: true,
        migration: 'MIG-FT-002'
    });
}
