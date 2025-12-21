// Stock Controller - CRUD for stock items and movements
import { Request, Response, NextFunction } from 'express';
import { PrismaClient, StockMovementType } from '@prisma/client';

const prisma = new PrismaClient();

// ==================== STOCK ITEMS ====================

export async function listStockItems(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const organizationId = req.user.organizationId;
        const { isFuel, isActive } = req.query;

        const where: any = {};
        if (organizationId) where.organizationId = organizationId;

        if (isFuel === 'true') where.isFuel = true;
        if (isFuel === 'false') where.isFuel = false;

        if (isActive === 'true') where.isActive = true;
        if (isActive === 'false') where.isActive = false;

        const items = await prisma.stockItem.findMany({
            where,
            orderBy: { name: 'asc' },
        });

        res.json({ data: items });
    } catch (err) {
        console.error('[stockItems] Error:', err);
        next(err);
    }
}

export async function createStockItem(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { name, code, unit, isFuel, isActive, group, itemType, balance, notes, storageLocation, fuelTypeId } = req.body;
        const organizationId = req.user.organizationId;

        if (!organizationId) {
            return res.status(400).json({ error: 'organizationId required' });
        }

        const item = await prisma.stockItem.create({
            data: {
                organizationId,
                name,
                code: code || null,
                unit: unit || 'шт',
                isFuel: isFuel || false,
                isActive: isActive !== false,
            },
        });

        res.status(201).json({ data: item });
    } catch (err) {
        console.error('[createStockItem] Error:', err);
        next(err);
    }
}

export async function updateStockItem(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;
        const { name, code, unit, isFuel, isActive } = req.body;

        const item = await prisma.stockItem.update({
            where: { id },
            data: {
                name,
                code: code || null,
                unit,
                isFuel: isFuel || false,
                isActive: isActive !== false,
            },
        });

        res.json({ data: item });
    } catch (err) {
        console.error('[updateStockItem] Error:', err);
        next(err);
    }
}

export async function deleteStockItem(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;

        await prisma.stockItem.delete({
            where: { id },
        });

        res.status(204).send();
    } catch (err) {
        console.error('[deleteStockItem] Error:', err);
        next(err);
    }
}

// ==================== STOCK MOVEMENTS (TRANSACTIONS) ====================

export async function listStockMovements(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const organizationId = req.user.organizationId;
        const { stockItemId, waybillId, driverId } = req.query as {
            stockItemId?: string;
            waybillId?: string;
            driverId?: string;
        };

        const where: any = {};
        if (organizationId) where.organizationId = organizationId;
        if (stockItemId) where.stockItemId = stockItemId;
        if (waybillId) where.documentId = waybillId;

        const [movements, total] = await Promise.all([
            prisma.stockMovement.findMany({
                where,
                include: {
                    stockItem: true,
                    warehouse: true,
                    stockLocation: true,
                    fromStockLocation: true,
                    toStockLocation: true,
                },
                orderBy: { occurredAt: 'desc' },
            }),
            prisma.stockMovement.count({ where })
        ]);

        res.json({
            data: movements.map(m => ({
                ...m,
                stockItemName: m.stockItem?.name,
                stockLocationName: m.stockLocation?.name,
                fromStockLocationName: m.fromStockLocation?.name,
                toStockLocationName: m.toStockLocation?.name,
            })),
            meta: { total }
        });
    } catch (err) {
        next(err);
    }
}

export async function createStockMovement(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { stockItemId, warehouseId, movementType, quantity, documentType, documentId, comment, items } = req.body;
        const organizationId = req.user.organizationId;
        const userId = req.user.id;

        if (!organizationId) {
            return res.status(400).json({ error: 'organizationId required' });
        }

        // Handle legacy format with items array
        if (items && Array.isArray(items) && items.length > 0) {
            const movements = await Promise.all(items.map(async (item: any) => {
                return prisma.stockMovement.create({
                    data: {
                        organizationId,
                        stockItemId: item.stockItemId,
                        warehouseId: warehouseId || null,
                        movementType: movementType === 'income' ? StockMovementType.INCOME : StockMovementType.EXPENSE,
                        quantity: item.quantity,
                        documentType: documentType || null,
                        documentId: documentId || null,
                        comment: comment || item.notes || null,
                        createdByUserId: userId,
                    },
                    include: {
                        stockItem: true,
                    },
                });
            }));
            return res.status(201).json({ data: movements[0], all: movements });
        }

        // Single movement
        const movement = await prisma.stockMovement.create({
            data: {
                organizationId,
                stockItemId,
                warehouseId: warehouseId || null,
                movementType: movementType === 'income' ? StockMovementType.INCOME : StockMovementType.EXPENSE,
                quantity,
                documentType: documentType || null,
                documentId: documentId || null,
                comment: comment || null,
                createdByUserId: userId,
            },
            include: {
                stockItem: true,
            },
        });

        res.status(201).json({ data: movement });
    } catch (err) {
        console.error('[createStockMovement] Error:', err);
        next(err);
    }
}

export async function updateStockMovement(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;
        const { stockItemId, warehouseId, movementType, quantity, documentType, documentId, comment } = req.body;

        // For now, limited update support - mainly for comment changes
        const movement = await prisma.stockMovement.update({
            where: { id },
            data: {
                stockItemId,
                warehouseId: warehouseId || null,
                movementType: movementType === 'income' ? StockMovementType.INCOME : StockMovementType.EXPENSE,
                quantity,
                documentType: documentType || null,
                documentId: documentId || null,
                comment: comment || null,
            },
            include: {
                stockItem: true,
            },
        });

        res.json({ data: movement });
    } catch (err) {
        console.error('[updateStockMovement] Error:', err);
        next(err);
    }
}

export async function deleteStockMovement(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;

        await prisma.stockMovement.delete({
            where: { id },
        });

        res.status(204).send();
    } catch (err) {
        console.error('[deleteStockMovement] Error:', err);
        next(err);
    }
}

// ==================== HELPER ENDPOINTS ====================

/**
 * Get fuel card balance for a driver
 * GET /api/stock/fuel-card-balance/:driverId
 */
export async function getFuelCardBalance(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { driverId } = req.params;

        // Get employee with fuel card balance
        const employee = await prisma.employee.findUnique({
            where: { id: driverId },
            select: { fuelCardBalance: true },
        });

        if (!employee) {
            return res.status(404).json({ error: 'Driver not found' });
        }

        res.json({ data: { balance: employee.fuelCardBalance || 0 } });
    } catch (err) {
        console.error('[getFuelCardBalance] Error:', err);
        next(err);
    }
}

/**
 * Get available fuel expenses for a driver (movements not yet linked to a waybill)
 * GET /api/stock/available-fuel-expenses/:driverId
 */
export async function getAvailableFuelExpenses(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { driverId } = req.params;
        const { waybillId } = req.query as { waybillId?: string };

        // For now, return empty since fuel expenses are managed differently in backend
        // This can be extended when fuel card integration is fully implemented
        res.json({ data: [] });
    } catch (err) {
        console.error('[getAvailableFuelExpenses] Error:', err);
        next(err);
    }
}

