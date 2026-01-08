import { Request, Response, NextFunction } from 'express';
import * as stockService from '../services/stockService';
import * as stockLocationService from '../services/stockLocationService';
import * as stornoService from '../services/stornoService';
import { BadRequestError } from '../utils/errors';
import { prisma } from '../db/prisma';

/**
 * REL-102: Stock Balance Controller
 * API для запроса остатков топлива на локациях
 */

/**
 * GET /stock/balances?stockItemId=...&asOf=...
 * Получить балансы всех локаций организации на дату
 */
export async function getBalances(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const user = req.user as { organizationId: string };

        const { stockItemId, asOf } = req.query;

        if (!stockItemId) {
            return res.json({
                asOf: new Date().toISOString(),
                stockItemId: null,
                locations: [],
            });
        }

        const asOfDate = asOf ? new Date(String(asOf)) : new Date();

        // RLS-STOCK-BAL-010: Driver RLS
        let filteredBalances;
        if (req.user && (req.user as any).role === 'driver' && (req.user as any).employeeId) {
            const employeeId = (req.user as any).employeeId;

            const driverLocs = await prisma.stockLocation.findMany({
                where: {
                    OR: [
                        { vehicle: { assignedDriverId: employeeId } },
                        { fuelCard: { assignedToDriver: { employeeId: employeeId } } }
                    ]
                },
                select: { id: true }
            });

            const driverLocIds = driverLocs.map(l => l.id);

            if (driverLocIds.length === 0) {
                return res.json({ asOf: asOfDate.toISOString(), stockItemId, data: [] });
            }

            const allBalances = await stockService.getBalancesAt(
                user.organizationId,
                String(stockItemId),
                asOfDate
            );

            filteredBalances = allBalances.filter(b => driverLocIds.includes(b.locationId));
        } else {
            filteredBalances = await stockService.getBalancesAt(
                user.organizationId,
                String(stockItemId),
                asOfDate
            );
        }

        res.json({
            asOf: asOfDate.toISOString(),
            stockItemId,
            data: filteredBalances,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * GET /stock/balance?locationId=...&stockItemId=...&asOf=...
 * Получить баланс одной локации на дату
 */
export async function getBalance(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { locationId, stockItemId, asOf } = req.query;

        if (!locationId) {
            throw new BadRequestError('locationId обязателен');
        }
        if (!stockItemId) {
            throw new BadRequestError('stockItemId обязателен');
        }

        const asOfDate = asOf ? new Date(String(asOf)) : new Date();

        const balance = await stockService.getBalanceAt(
            String(locationId),
            String(stockItemId),
            asOfDate
        );

        res.json({
            locationId,
            stockItemId,
            asOf: asOfDate.toISOString(),
            balance,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * GET /stock/movements/v2
 * STOCK-MOVEMENTS-V2-GET-001/002: List movements with filters and pagination
 * Query params:
 *   - locationId: filter by any location (stockLocationId, fromStockLocationId, toStockLocationId)
 *   - stockItemId: filter by stock item
 *   - movementType: INCOME | EXPENSE | ADJUSTMENT | TRANSFER
 *   - from/occurredFrom: ISO date (occurredAt >= from)
 *   - to/occurredTo: ISO date (occurredAt <= to)
 *   - page: page number (default 1)
 *   - pageSize: items per page (default 50, max 200)
 */
export async function listMovementsV2(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const user = req.user as { organizationId: string };

        const {
            locationId,
            stockItemId,
            movementType,
            from,
            to,
            occurredFrom: occurredFromAlt,
            occurredTo: occurredToAlt,
            page: pageStr,
            pageSize: pageSizeStr,
        } = req.query;

        // Support both from/to and occurredFrom/occurredTo (prefer from/to)
        const occurredFromStr = (from ?? occurredFromAlt) as string | undefined;
        const occurredToStr = (to ?? occurredToAlt) as string | undefined;

        // Validate dates
        let occurredFrom: Date | undefined;
        let occurredTo: Date | undefined;

        if (occurredFromStr) {
            occurredFrom = new Date(occurredFromStr);
            if (isNaN(occurredFrom.getTime())) {
                throw new BadRequestError('Invalid from/occurredFrom date format');
            }
        }
        if (occurredToStr) {
            occurredTo = new Date(occurredToStr);
            if (isNaN(occurredTo.getTime())) {
                throw new BadRequestError('Invalid to/occurredTo date format');
            }
        }

        // Validate movementType enum
        const validMovementTypes = ['INCOME', 'EXPENSE', 'ADJUSTMENT', 'TRANSFER'];
        if (movementType && !validMovementTypes.includes(String(movementType))) {
            throw new BadRequestError(`Invalid movementType. Must be one of: ${validMovementTypes.join(', ')}`);
        }

        const page = Math.max(1, parseInt(String(pageStr || '1'), 10));
        const pageSize = Math.min(200, Math.max(1, parseInt(String(pageSizeStr || '50'), 10)));

        // Build where clause
        const where: any = {
            organizationId: user.organizationId,
            isVoid: false, // P1-3: Exclude voided movements
        };

        if (movementType) {
            where.movementType = String(movementType);
        }
        if (stockItemId) {
            where.stockItemId = String(stockItemId);
        }

        // Date range filter
        if (occurredFrom || occurredTo) {
            where.occurredAt = {};
            if (occurredFrom) {
                where.occurredAt.gte = occurredFrom;
            }
            if (occurredTo) {
                where.occurredAt.lte = occurredTo;
            }
        }

        // RLS-STOCK-MOV-010: Driver RLS
        if (req.user && (req.user as any).role === 'driver' && (req.user as any).employeeId) {
            const employeeId = (req.user as any).employeeId;

            // Get driver's locations
            const driverLocs = await prisma.stockLocation.findMany({
                where: {
                    OR: [
                        { vehicle: { assignedDriverId: employeeId } },
                        { fuelCard: { assignedToDriver: { employeeId: employeeId } } }
                    ]
                },
                select: { id: true }
            });

            const driverLocIds = driverLocs.map(l => l.id);

            if (driverLocIds.length === 0) {
                return res.json({ success: true, data: [], total: 0, page, pageSize });
            }

            // If locationId provided, check if it belongs to driver
            if (locationId) {
                if (!driverLocIds.includes(String(locationId))) {
                    return res.json({ success: true, data: [], total: 0, page, pageSize });
                }
            } else {
                // Limit to driver's locations only
                where.OR = [
                    { stockLocationId: { in: driverLocIds } },
                    { fromStockLocationId: { in: driverLocIds } },
                    { toStockLocationId: { in: driverLocIds } },
                ];
            }
        } else if (locationId) {
            // Standard location filter for non-drivers
            where.OR = [
                { stockLocationId: String(locationId) },
                { fromStockLocationId: String(locationId) },
                { toStockLocationId: String(locationId) },
            ];
        }

        const [total, items] = await Promise.all([
            prisma.stockMovement.count({ where }),
            prisma.stockMovement.findMany({
                where,
                orderBy: [
                    { occurredAt: 'desc' },
                    { occurredSeq: 'desc' },
                    { createdAt: 'desc' },
                ],
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: {
                    stockItem: { select: { id: true, name: true } },
                    stockLocation: { select: { id: true, name: true, type: true } },
                    fromStockLocation: { select: { id: true, name: true, type: true } },
                    toStockLocation: { select: { id: true, name: true, type: true } },
                    createdByUser: { select: { id: true, email: true } },
                },
            }),
        ]);

        res.json({
            success: true,
            data: items,
            total,
            page,
            pageSize,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * POST /stock/movements
 * Создать движение (INCOME, EXPENSE, ADJUSTMENT, TRANSFER)
 */
export async function createMovement(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const user = req.user as { organizationId: string; id: string };

        const {
            movementType,
            stockItemId,
            quantity,
            stockLocationId,
            fromLocationId,
            toLocationId,
            occurredAt,
            occurredSeq,
            documentType,
            documentId,
            externalRef,
            comment,
            unitCost,  // COST-001: Unit cost for INCOME
        } = req.body;

        if (!movementType) {
            throw new BadRequestError('movementType обязателен (INCOME, EXPENSE, ADJUSTMENT, TRANSFER)');
        }
        if (!stockItemId) {
            throw new BadRequestError('stockItemId обязателен');
        }

        // BE-005: Parse quantity to number (DTO validates as string for Decimal compatibility)
        const parsedQuantity = typeof quantity === 'string' ? parseFloat(quantity) : Number(quantity);
        if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
            throw new BadRequestError('quantity должен быть положительным числом');
        }

        // COST-001: Parse unitCost
        const parsedUnitCost = unitCost !== undefined && unitCost !== null && unitCost !== ''
            ? (typeof unitCost === 'string' ? parseFloat(unitCost) : Number(unitCost))
            : undefined;

        let result;
        const occurredAtDate = occurredAt ? new Date(occurredAt) : new Date();

        // Track affected locations for tank sync
        const affectedLocationIds: string[] = [];

        switch (movementType) {
            case 'TRANSFER':
                if (!fromLocationId || !toLocationId) {
                    throw new BadRequestError('Для TRANSFER требуются fromLocationId и toLocationId');
                }
                result = await stockService.createTransfer({
                    organizationId: user.organizationId,
                    stockItemId,
                    quantity: parsedQuantity,
                    fromLocationId,
                    toLocationId,
                    occurredAt: occurredAtDate,
                    occurredSeq,
                    documentType,
                    documentId,
                    externalRef,
                    comment,
                    userId: user.id,
                });
                affectedLocationIds.push(fromLocationId, toLocationId);
                break;

            case 'INCOME':
                result = await stockService.createIncomeMovement(
                    user.organizationId,
                    stockItemId,
                    parsedQuantity,
                    documentType,
                    documentId,
                    user.id,
                    null,  // warehouseId deprecated
                    comment,
                    stockLocationId,
                    occurredAtDate,
                    parsedUnitCost  // COST-001: Pass unit cost
                );
                if (stockLocationId) affectedLocationIds.push(stockLocationId);
                break;

            case 'EXPENSE':
                result = await stockService.createExpenseMovement(
                    user.organizationId,
                    stockItemId,
                    parsedQuantity,
                    documentType,
                    documentId,
                    user.id,
                    null,  // warehouseId deprecated
                    comment,
                    stockLocationId,
                    occurredAtDate
                );
                if (stockLocationId) affectedLocationIds.push(stockLocationId);
                break;

            case 'ADJUSTMENT':
                if (!stockLocationId) {
                    throw new BadRequestError('stockLocationId обязателен для ADJUSTMENT');
                }
                if (!comment) {
                    throw new BadRequestError('Комментарий обязателен для ADJUSTMENT');
                }
                result = await stockService.createAdjustment({
                    organizationId: user.organizationId,
                    stockItemId,
                    stockLocationId,
                    quantity: parsedQuantity, // Can be negative
                    occurredAt: occurredAtDate,
                    occurredSeq,
                    documentType,
                    documentId,
                    externalRef,
                    comment,
                    userId: user.id,
                });
                affectedLocationIds.push(stockLocationId);
                break;

            default:
                throw new BadRequestError(`Неизвестный movementType: ${movementType}`);
        }

        // VEHICLE-TANK-SYNC: Update Vehicle.currentFuel if any affected location is a VEHICLE_TANK
        for (const locId of affectedLocationIds) {
            await syncVehicleTankBalance(locId, stockItemId);
        }

        res.status(201).json(result);
    } catch (error) {
        next(error);
    }
}

/**
 * VEHICLE-TANK-SYNC: Helper function to sync Vehicle.currentFuel with ledger balance
 * Called after movements that affect VEHICLE_TANK locations
 */
async function syncVehicleTankBalance(locationId: string, stockItemId: string): Promise<void> {
    try {
        // 1. Check if location is a VEHICLE_TANK
        const location = await prisma.stockLocation.findUnique({
            where: { id: locationId },
            select: { type: true, vehicleId: true }
        });

        if (!location || location.type !== 'VEHICLE_TANK' || !location.vehicleId) {
            return; // Not a tank location, skip
        }

        // 2. Get current balance from ledger
        const balance = await stockService.getBalanceAt(locationId, stockItemId, new Date());

        // 3. Update Vehicle.currentFuel
        await prisma.vehicle.update({
            where: { id: location.vehicleId },
            data: { currentFuel: balance }
        });

        console.log(`[VEHICLE-TANK-SYNC] Updated vehicle ${location.vehicleId} currentFuel to ${balance}`);
    } catch (err) {
        // Log but don't throw - sync is best-effort
        console.error('[VEHICLE-TANK-SYNC] Error syncing tank balance:', err);
    }
}

/**
 * LEDGER-DOCS-BE-020: Storno Document
 * POST /stock/documents/:documentType/:documentId/storno
 * Создать сторнирующие движения для документа
 */
export async function stornoDocument(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const user = req.user as { organizationId: string; id: string };
        const { documentType, documentId } = req.params;
        const { reason } = req.body;

        if (!reason) {
            throw new BadRequestError('reason обязателен');
        }

        const result = await stornoService.stornoDocument(
            user.organizationId,
            documentType,
            documentId,
            reason,
            user.id
        );

        res.json(result);
    } catch (error) {
        next(error);
    }
}

/**
 * LEDGER-DOCS-BE-030: Create Correction
 * POST /stock/corrections
 * Создать документ корректировки (ADJUSTMENT с автоматическим documentType='CORRECTION')
 * 
 * Body: {
 *   stockItemId: string,
 *   stockLocationId: string,
 *   quantity: number,  // положительное = добавить, отрицательное = списать
 *   reason: string,    // обязательная причина
 *   occurredAt?: string // дата корректировки (по умолчанию now)
 * }
 */
export async function createCorrection(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const user = req.user as { organizationId: string; id: string };
        const { stockItemId, stockLocationId, quantity, reason, occurredAt } = req.body;

        if (!stockItemId) {
            throw new BadRequestError('stockItemId обязателен');
        }
        if (!stockLocationId) {
            throw new BadRequestError('stockLocationId обязателен');
        }
        if (quantity === undefined || quantity === null) {
            throw new BadRequestError('quantity обязателен');
        }
        if (!reason) {
            throw new BadRequestError('reason обязателен');
        }

        const parsedQuantity = typeof quantity === 'string' ? parseFloat(quantity) : Number(quantity);
        if (isNaN(parsedQuantity)) {
            throw new BadRequestError('quantity должен быть числом');
        }

        // Generate unique documentId for this correction
        const documentId = crypto.randomUUID();
        const occurredAtDate = occurredAt ? new Date(occurredAt) : new Date();

        const movement = await stockService.createAdjustment({
            organizationId: user.organizationId,
            stockItemId,
            stockLocationId,
            quantity: parsedQuantity,
            occurredAt: occurredAtDate,
            documentType: 'CORRECTION', // LEDGER-DOCS: Fixed document type
            documentId,
            comment: reason,
            userId: user.id,
        });

        // VEHICLE-TANK-SYNC: Update Vehicle.currentFuel if correction is for a VEHICLE_TANK
        await syncVehicleTankBalance(stockLocationId, stockItemId);

        res.status(201).json({
            success: true,
            correctionId: documentId,
            movement,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * GET /stock/movements/my
 * DRIVER-STOCK-MOVEMENTS-002: Driver sees only their own movements (cards + tanks)
 * 
 * Query params:
 *   - from/occurredFrom, to/occurredTo: ISO date range
 *   - movementType: INCOME | EXPENSE | ADJUSTMENT | TRANSFER
 *   - stockItemId: filter by fuel type (auto-detected from vehicle if not provided)
 *   - page, pageSize: pagination (default 50, max 200)
 */
export async function listMyMovementsV2(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const user = req.user as {
            id: string;
            organizationId: string;
            employeeId: string | null;
            role: string;
        };

        // Driver scope guard
        if (user.role !== 'driver') {
            return res.status(403).json({
                error: 'DRIVER_ONLY_ENDPOINT',
                message: 'Этот endpoint доступен только для водителей'
            });
        }

        if (!user.employeeId) {
            return res.status(403).json({
                error: 'NO_EMPLOYEE_LINK',
                message: 'Пользователь не связан с сотрудником'
            });
        }

        // Find Driver by employeeId
        const driver = await prisma.driver.findUnique({
            where: { employeeId: user.employeeId }
        });

        if (!driver) {
            return res.json({ success: true, data: [], total: 0, page: 1, pageSize: 50 });
        }

        // Determine stockItemId: from query or from first vehicle
        const vehicles = await prisma.vehicle.findMany({
            where: {
                organizationId: user.organizationId,
                assignedDriverId: user.employeeId
            },
            orderBy: { registrationNumber: 'asc' },  // Deterministic order
            select: { id: true, fuelStockItemId: true }
        });

        let effectiveStockItemId = req.query.stockItemId
            ? String(req.query.stockItemId)
            : null;

        // Auto-detect from first vehicle if not provided
        if (!effectiveStockItemId && vehicles.length > 0) {
            effectiveStockItemId = vehicles[0].fuelStockItemId || null;
        }

        // Collect "own" locationIds
        const locationIds: string[] = [];

        // Fuel cards assigned to driver
        const fuelCards = await prisma.fuelCard.findMany({
            where: {
                organizationId: user.organizationId,
                assignedToDriverId: driver.id,
                isActive: true
            },
            select: { id: true }
        });

        for (const card of fuelCards) {
            try {
                const loc = await stockLocationService.getOrCreateFuelCardLocation(card.id);
                locationIds.push(loc.id);
            } catch (e) {
                console.warn(`[listMyMovementsV2] Failed to get location for card ${card.id}`, e);
            }
        }

        // Vehicle tanks for assigned vehicles
        for (const v of vehicles) {
            try {
                const loc = await stockLocationService.getOrCreateVehicleTankLocation(v.id);
                locationIds.push(loc.id);
            } catch (e) {
                console.warn(`[listMyMovementsV2] Failed to get location for vehicle ${v.id}`, e);
            }
        }

        // Deduplicate
        const uniqueLocationIds = [...new Set(locationIds)];

        if (uniqueLocationIds.length === 0) {
            return res.json({ success: true, data: [], total: 0, page: 1, pageSize: 50 });
        }

        // Parse query params (reuse v2 aliases)
        const {
            from,
            to,
            occurredFrom: occurredFromAlt,
            occurredTo: occurredToAlt,
            movementType,
            page: pageStr,
            pageSize: pageSizeStr,
        } = req.query;

        // Support both from/to and occurredFrom/occurredTo (prefer from/to)
        const occurredFromStr = (from ?? occurredFromAlt) as string | undefined;
        const occurredToStr = (to ?? occurredToAlt) as string | undefined;

        const page = Math.max(1, parseInt(String(pageStr || '1'), 10));
        const pageSize = Math.min(200, Math.max(1, parseInt(String(pageSizeStr || '50'), 10)));

        // Build where clause
        const where: any = {
            organizationId: user.organizationId,
            isVoid: false,
            OR: [
                { stockLocationId: { in: uniqueLocationIds } },
                { fromStockLocationId: { in: uniqueLocationIds } },
                { toStockLocationId: { in: uniqueLocationIds } },
            ]
        };

        if (movementType) {
            where.movementType = String(movementType);
        }
        if (effectiveStockItemId) {
            where.stockItemId = effectiveStockItemId;
        }

        // Date range filter
        if (occurredFromStr || occurredToStr) {
            where.occurredAt = {};
            if (occurredFromStr) where.occurredAt.gte = new Date(occurredFromStr);
            if (occurredToStr) where.occurredAt.lte = new Date(occurredToStr);
        }

        // Query with same sorting as v2
        const [total, items] = await Promise.all([
            prisma.stockMovement.count({ where }),
            prisma.stockMovement.findMany({
                where,
                orderBy: [
                    { occurredAt: 'desc' },
                    { occurredSeq: 'desc' },
                    { createdAt: 'desc' },
                ],
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: {
                    stockItem: { select: { id: true, name: true } },
                    stockLocation: { select: { id: true, name: true, type: true } },
                    fromStockLocation: { select: { id: true, name: true, type: true } },
                    toStockLocation: { select: { id: true, name: true, type: true } },
                    createdByUser: { select: { id: true, email: true } },
                },
            }),
        ]);

        res.json({
            success: true,
            data: items,
            total,
            page,
            pageSize,
            meta: {
                locationIds: uniqueLocationIds,
                effectiveStockItemId,
            }
        });
    } catch (error) {
        next(error);
    }
}
