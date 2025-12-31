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

        const where: any = {
            isVoid: false, // P1-3: Exclude voided movements
        };
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

// P0-1: STOCK-LEGACY-POST-410 — Legacy endpoint disabled
export async function createStockMovement(req: Request, res: Response, next: NextFunction) {
    return res.status(410).json({
        error: 'This endpoint is deprecated and has been disabled.',
        code: 'ENDPOINT_GONE',
        migration: {
            endpoint: 'POST /api/stock/movements/v2',
            changes: [
                'Use Zod-validated DTO',
                'Use stockLocationId instead of warehouseId',
                'Specify movementType: INCOME | EXPENSE | ADJUSTMENT | TRANSFER',
                'All movements go through Service Layer with balance checks'
            ],
            documentation: 'See STOCK_MOVEMENT_AUDIT.md for details'
        }
    });
}

export async function updateStockMovement(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;
        const { stockItemId, warehouseId, movementType, quantity, documentType, documentId, comment } = req.body;
        const organizationId = req.user.organizationId;

        // For now, limited update support - mainly for comment changes
        // Use robust service method that handles balance checks and locking
        const { updateStockMovement } = await import('../services/stockService');

        const movement = await updateStockMovement({
            id,
            organizationId,
            userId: req.user.id,
            movementType: movementType ? (StockMovementType[movementType as keyof typeof StockMovementType] || movementType) : undefined,
            stockItemId,
            quantity,
            stockLocationId: req.body.stockLocationId, // Ensure these are passed from body
            fromLocationId: req.body.fromLocationId,
            toLocationId: req.body.toLocationId,
            occurredAt: req.body.occurredAt ? new Date(req.body.occurredAt) : undefined,
            externalRef: req.body.externalRef,
            comment,
        });

        // Refetch to include relations for response consistency
        const updated = await prisma.stockMovement.findUnique({
            where: { id: movement.id },
            include: {
                stockItem: true,
                stockLocation: true,
                fromStockLocation: true,
                toStockLocation: true
            }
        });

        res.json({ data: updated });

        res.json({ data: movement });
    } catch (err) {
        console.error('[updateStockMovement] Error:', err);
        next(err);
    }
}

// P0-2: STOCK-DELETE-BLOCK — Hard delete blocked, use void operation instead
export async function deleteStockMovement(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;
        const organizationId = req.user.organizationId;

        // Get movement to check documentType
        const movement = await prisma.stockMovement.findFirst({
            where: { id, organizationId },
            select: { documentType: true }
        });

        if (!movement) {
            return res.status(404).json({ error: 'Movement not found' });
        }

        // P0-2: Block system movements (CRITICAL)
        const systemDocTypes = ['WAYBILL', 'FUEL_CARD_RESET', 'FUEL_CARD_TOPUP'];
        if (movement.documentType && systemDocTypes.includes(movement.documentType)) {
            return res.status(403).json({
                error: 'Cannot delete system-generated movements',
                code: 'SYSTEM_MOVEMENT_DELETE_FORBIDDEN',
                documentType: movement.documentType,
                hint: 'System movements are immutable. Contact administrator if correction is needed.'
            });
        }

        // P0-2: Block ALL hard deletes unless allowed by settings
        const { getAppSettings } = await import('../services/settingsService');
        const settings = await getAppSettings();

        if (settings.allowDirectStockMovementDeletion) {
            await prisma.stockMovement.delete({ where: { id } });
            return res.status(204).send();
        }

        return res.status(405).json({
            error: 'Hard delete is disabled. Use void operation instead (or enable direct deletion in Settings).',
            code: 'DELETE_METHOD_NOT_ALLOWED',
            migration: {
                endpoint: 'POST /api/stock/movements/:id/void',
                status: 'Coming in PR2 (STOCK-VOID)',
                eta: 'Next release'
            }
        });

        // This code will never execute, but kept for reference
        // await prisma.stockMovement.delete({ where: { id } });
        // res.status(204).send();
    } catch (err) {
        console.error('[deleteStockMovement] Error:', err);
        next(err);
    }
}

// P1-1: STOCK-VOID — Void endpoint for manual movements
export async function voidStockMovementController(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;
        const { reason } = req.body;

        // Validation
        if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
            return res.status(400).json({
                error: 'Void reason is required and must be at least 5 characters',
                code: 'INVALID_VOID_REASON',
            });
        }

        const { voidStockMovement } = await import('../services/stockService');

        const voided = await voidStockMovement({
            id,
            organizationId: req.user.organizationId,
            userId: req.user.id,
            reason: reason.trim(),
        });

        res.json({ success: true, data: voided });
    } catch (err: any) {
        console.error('[voidStockMovement] Full error:', {
            message: err.message,
            stack: err.stack,
            name: err.name,
        });
        next(err);
    }
}

/**
 * FUEL-CARD-LINK-BE-010: Get fuel card balance for a driver using ledger
 * GET /api/stock/fuel-card-balance/:driverId
 * 
 * Now properly uses:
 * 1. FuelCard.assignedToDriverId = Driver.id
 * 2. StockLocation linked to FuelCard
 * 3. Ledger balance from StockMovement
 */
export async function getFuelCardBalance(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { driverId } = req.params;
        const organizationId = req.user.organizationId;

        // Find all fuel cards assigned to this driver
        const fuelCards = await prisma.fuelCard.findMany({
            where: {
                organizationId,
                assignedToDriverId: driverId,
                isActive: true,
            },
            include: {
                stockLocation: true,
            },
        });

        if (fuelCards.length === 0) {
            // No cards assigned - return zero balance
            return res.json({
                data: {
                    balance: 0,
                    cards: [],
                    message: 'No fuel cards assigned to this driver'
                }
            });
        }

        // Get all fuel stock items for balance calculation
        const fuelItems = await prisma.stockItem.findMany({
            where: {
                organizationId,
                isFuel: true,
                isActive: true,
            },
        });

        // Calculate balance for each card from ledger
        const cardBalances = await Promise.all(
            fuelCards.map(async (card) => {
                if (!card.stockLocation) {
                    return {
                        cardId: card.id,
                        cardNumber: card.cardNumber,
                        provider: card.provider,
                        balance: 0,
                        balanceByItem: [],
                        hasLocation: false,
                    };
                }

                // Calculate balance for each fuel type
                const balanceByItem = await Promise.all(
                    fuelItems.map(async (item) => {
                        // Import getBalanceAt from stockService
                        const { getBalanceAt } = await import('../services/stockService');
                        const balance = await getBalanceAt(
                            card.stockLocation!.id,
                            item.id,
                            new Date()
                        );
                        return {
                            stockItemId: item.id,
                            stockItemName: item.name,
                            unit: item.unit,
                            balance,
                        };
                    })
                );

                // Sum all fuel balances for total
                const totalBalance = balanceByItem.reduce((sum, b) => sum + b.balance, 0);

                return {
                    cardId: card.id,
                    cardNumber: card.cardNumber,
                    provider: card.provider,
                    balance: totalBalance,
                    balanceByItem: balanceByItem.filter(b => b.balance !== 0),
                    hasLocation: true,
                };
            })
        );

        // Calculate total balance across all cards
        const totalBalance = cardBalances.reduce((sum, c) => sum + c.balance, 0);

        res.json({
            data: {
                balance: totalBalance,
                cards: cardBalances,
            }
        });
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

