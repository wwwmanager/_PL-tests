import { PrismaClient, StockMovementType, Prisma } from '@prisma/client';
import { BadRequestError } from '../utils/errors';

const prisma = new PrismaClient();

// ============================================================================
// BE-005: Advisory Lock Helpers for Race Condition Protection
// ============================================================================

/**
 * Hash a string to a 32-bit integer for pg_advisory_lock
 * Uses simple FNV-1a hash algorithm
 */
function hashKey(key: string): number {
    let hash = 2166136261; // FNV offset basis
    for (let i = 0; i < key.length; i++) {
        hash ^= key.charCodeAt(i);
        hash = (hash * 16777619) >>> 0; // FNV prime, keep as unsigned 32-bit
    }
    return hash | 0; // Convert to signed 32-bit integer
}

/**
 * Acquire an advisory lock for a location+stockItem combination
 * Must be called inside a $transaction
 */
async function acquireLocationLock(
    tx: Prisma.TransactionClient,
    stockLocationId: string,
    stockItemId: string
): Promise<void> {
    const lockKey = hashKey(`stock:${stockLocationId}:${stockItemId}`);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;
}

/**
 * Acquire locks for multiple locations in deterministic order
 * Prevents deadlocks by always locking in the same order
 */
async function acquireLocationLocks(
    tx: Prisma.TransactionClient,
    locationIds: string[],
    stockItemId: string
): Promise<void> {
    // Sort location IDs to ensure consistent lock order (prevents deadlocks)
    const sortedIds = [...locationIds].sort();
    for (const locationId of sortedIds) {
        await acquireLocationLock(tx, locationId, stockItemId);
    }
}

/**
 * Get balance within a transaction context
 */
async function getBalanceAtTx(
    tx: Prisma.TransactionClient,
    stockLocationId: string,
    stockItemId: string,
    asOf: Date
): Promise<number> {
    const [incomes, expenses, adjustments, transfersIn, transfersOut] = await Promise.all([
        tx.stockMovement.aggregate({
            where: { stockLocationId, stockItemId, movementType: StockMovementType.INCOME, occurredAt: { lte: asOf } },
            _sum: { quantity: true },
        }),
        tx.stockMovement.aggregate({
            where: { stockLocationId, stockItemId, movementType: StockMovementType.EXPENSE, occurredAt: { lte: asOf } },
            _sum: { quantity: true },
        }),
        tx.stockMovement.aggregate({
            where: { stockLocationId, stockItemId, movementType: StockMovementType.ADJUSTMENT, occurredAt: { lte: asOf } },
            _sum: { quantity: true },
        }),
        tx.stockMovement.aggregate({
            where: { toStockLocationId: stockLocationId, stockItemId, movementType: StockMovementType.TRANSFER, occurredAt: { lte: asOf } },
            _sum: { quantity: true },
        }),
        tx.stockMovement.aggregate({
            where: { fromStockLocationId: stockLocationId, stockItemId, movementType: StockMovementType.TRANSFER, occurredAt: { lte: asOf } },
            _sum: { quantity: true },
        }),
    ]);

    return (
        Number(incomes._sum.quantity || 0) -
        Number(expenses._sum.quantity || 0) +
        Number(adjustments._sum.quantity || 0) +
        Number(transfersIn._sum.quantity || 0) -
        Number(transfersOut._sum.quantity || 0)
    );
}

// ============================================================================
// REL-102: Balance Calculation (with temporal support)
// ============================================================================

/**
 * Получить баланс локации на указанную дату
 * Учитывает все движения с occurredAt <= asOf
 */
export async function getBalanceAt(
    stockLocationId: string,
    stockItemId: string,
    asOf: Date = new Date()
): Promise<number> {
    // Получаем все движения для этой локации до указанной даты
    const [incomes, expenses, adjustments, transfersIn, transfersOut] = await Promise.all([
        // INCOME: приходы на эту локацию
        prisma.stockMovement.aggregate({
            where: {
                stockLocationId,
                stockItemId,
                movementType: StockMovementType.INCOME,
                occurredAt: { lte: asOf },
            },
            _sum: { quantity: true },
        }),
        // EXPENSE: расходы с этой локации
        prisma.stockMovement.aggregate({
            where: {
                stockLocationId,
                stockItemId,
                movementType: StockMovementType.EXPENSE,
                occurredAt: { lte: asOf },
            },
            _sum: { quantity: true },
        }),
        // ADJUSTMENT: корректировки (могут быть + или -)
        prisma.stockMovement.aggregate({
            where: {
                stockLocationId,
                stockItemId,
                movementType: StockMovementType.ADJUSTMENT,
                occurredAt: { lte: asOf },
            },
            _sum: { quantity: true },
        }),
        // TRANSFER IN: переводы НА эту локацию
        prisma.stockMovement.aggregate({
            where: {
                toStockLocationId: stockLocationId,
                stockItemId,
                movementType: StockMovementType.TRANSFER,
                occurredAt: { lte: asOf },
            },
            _sum: { quantity: true },
        }),
        // TRANSFER OUT: переводы С этой локации
        prisma.stockMovement.aggregate({
            where: {
                fromStockLocationId: stockLocationId,
                stockItemId,
                movementType: StockMovementType.TRANSFER,
                occurredAt: { lte: asOf },
            },
            _sum: { quantity: true },
        }),
    ]);

    const income = Number(incomes._sum.quantity || 0);
    const expense = Number(expenses._sum.quantity || 0);
    const adjustment = Number(adjustments._sum.quantity || 0);
    const transferIn = Number(transfersIn._sum.quantity || 0);
    const transferOut = Number(transfersOut._sum.quantity || 0);

    return income - expense + adjustment + transferIn - transferOut;
}

export interface LocationBalance {
    locationId: string;
    locationName: string;
    locationType: string;
    balance: number;
}

/**
 * Получить балансы всех локаций организации на указанную дату
 */
export async function getBalancesAt(
    organizationId: string,
    stockItemId: string,
    asOf: Date = new Date()
): Promise<LocationBalance[]> {
    // Получаем все активные локации организации
    const locations = await prisma.stockLocation.findMany({
        where: {
            organizationId,
            isActive: true,
        },
        select: {
            id: true,
            name: true,
            type: true,
        },
    });

    // Параллельно считаем баланс каждой локации
    const balances = await Promise.all(
        locations.map(async (loc) => ({
            locationId: loc.id,
            locationName: loc.name,
            locationType: loc.type,
            balance: await getBalanceAt(loc.id, stockItemId, asOf),
        }))
    );

    // Фильтруем локации с нулевым балансом (опционально)
    return balances;
}

// ============================================================================
// REL-102: TRANSFER operation
// ============================================================================

export interface CreateTransferParams {
    organizationId: string;
    stockItemId: string;
    quantity: number;
    fromLocationId: string;
    toLocationId: string;
    occurredAt?: Date;
    occurredSeq?: number;
    documentType?: string;
    documentId?: string;
    externalRef?: string;
    comment?: string;
    userId?: string;
}

/**
 * Создать TRANSFER — перемещение между локациями
 * BE-005: Uses advisory locks to prevent race conditions
 * - Locks both locations in sorted order (prevents deadlocks)
 * - Balance check + insert in single transaction
 */
export async function createTransfer(params: CreateTransferParams) {
    const {
        organizationId,
        stockItemId,
        quantity,
        fromLocationId,
        toLocationId,
        occurredAt = new Date(),
        occurredSeq = 0,
        documentType,
        documentId,
        externalRef,
        comment,
        userId,
    } = params;

    return prisma.$transaction(async (tx) => {
        // BE-005: Acquire locks on both locations in deterministic order
        await acquireLocationLocks(tx, [fromLocationId, toLocationId], stockItemId);

        // Check balance with lock held
        const sourceBalance = await getBalanceAtTx(tx, fromLocationId, stockItemId, occurredAt);

        if (sourceBalance < quantity) {
            throw new BadRequestError(
                `Недостаточно топлива на локации-источнике. Требуется: ${quantity}, доступно: ${sourceBalance}`
            );
        }

        // Create TRANSFER movement
        return tx.stockMovement.create({
            data: {
                organizationId,
                stockItemId,
                movementType: StockMovementType.TRANSFER,
                quantity,
                fromStockLocationId: fromLocationId,
                toStockLocationId: toLocationId,
                occurredAt,
                occurredSeq,
                documentType,
                documentId,
                externalRef,
                comment,
                createdByUserId: userId,
            },
        });
    });
}

// ============================================================================
// BE-002: ADJUSTMENT operation
// ============================================================================

export interface CreateAdjustmentParams {
    organizationId: string;
    stockItemId: string;
    stockLocationId: string;
    quantity: number;  // Can be negative
    occurredAt: Date;
    occurredSeq?: number;
    documentType?: string;
    documentId?: string;
    externalRef?: string;
    comment: string;  // Required for ADJUSTMENT
    userId?: string;
}

/**
 * Создать ADJUSTMENT — корректировка остатка (может быть + или -)
 * BE-002: Если quantity < 0, проверяем что баланс не уйдёт в минус
 * BE-005: Uses advisory lock for negative adjustments
 */
export async function createAdjustment(params: CreateAdjustmentParams) {
    const {
        organizationId,
        stockItemId,
        stockLocationId,
        quantity,
        occurredAt,
        occurredSeq = 0,
        documentType,
        documentId,
        externalRef,
        comment,
        userId,
    } = params;

    // If negative adjustment, use transaction with lock
    if (quantity < 0) {
        return prisma.$transaction(async (tx) => {
            // BE-005: Acquire lock on location
            await acquireLocationLock(tx, stockLocationId, stockItemId);

            // Check balance with lock held
            const currentBalance = await getBalanceAtTx(tx, stockLocationId, stockItemId, occurredAt);
            const resultingBalance = currentBalance + quantity; // quantity is negative

            if (resultingBalance < 0) {
                throw new BadRequestError(
                    `Корректировка ${quantity} приведёт к отрицательному остатку. Текущий баланс: ${currentBalance}, результат: ${resultingBalance}`
                );
            }

            // Create ADJUSTMENT movement
            return tx.stockMovement.create({
                data: {
                    organizationId,
                    stockItemId,
                    stockLocationId,
                    movementType: StockMovementType.ADJUSTMENT,
                    quantity,
                    occurredAt,
                    occurredSeq,
                    documentType,
                    documentId,
                    externalRef,
                    comment,
                    createdByUserId: userId,
                },
            });
        });
    }

    // Positive adjustment doesn't need locking
    return prisma.stockMovement.create({
        data: {
            organizationId,
            stockItemId,
            stockLocationId,
            movementType: StockMovementType.ADJUSTMENT,
            quantity,
            occurredAt,
            occurredSeq,
            documentType,
            documentId,
            externalRef,
            comment,
            createdByUserId: userId,
        },
    });
}

// ============================================================================
// Legacy methods (kept for backward compatibility)
// ============================================================================

/**
 * Проверяет наличие достаточного количества товара на складе
 * @deprecated Use getBalanceAt with stockLocationId instead
 */
export async function checkStockAvailability(
    organizationId: string,
    stockItemId: string,
    warehouseId: string | null,
    requiredQuantity: number
): Promise<boolean> {
    const balance = await getStockBalance(organizationId, stockItemId, warehouseId);
    return balance >= requiredQuantity;
}

/**
 * Получает текущий остаток товара на складе
 * @deprecated Use getBalanceAt with stockLocationId instead
 */
export async function getStockBalance(
    organizationId: string,
    stockItemId: string,
    warehouseId: string | null
): Promise<number> {
    const where: any = {
        organizationId,
        stockItemId,
    };

    if (warehouseId) {
        where.warehouseId = warehouseId;
    }

    const movements = await prisma.stockMovement.findMany({
        where,
        select: {
            movementType: true,
            quantity: true,
        },
    });

    let balance = 0;
    for (const movement of movements) {
        if (movement.movementType === StockMovementType.INCOME) {
            balance += Number(movement.quantity);
        } else if (movement.movementType === StockMovementType.EXPENSE) {
            balance -= Number(movement.quantity);
        } else if (movement.movementType === StockMovementType.TRANSFER) {
            // TRANSFERы не влияют на warehouse-based balance (they use locationId)
        }
        // ADJUSTMENT может быть положительным или отрицательным - для простоты пока игнорируем
    }

    return balance;
}

// ============================================================================
// REL-102: Enhanced INCOME/EXPENSE with stockLocationId
// ============================================================================

export interface CreateMovementParams {
    organizationId: string;
    stockItemId: string;
    quantity: number;
    stockLocationId?: string;
    warehouseId?: string;  // deprecated, for backward compatibility
    occurredAt?: Date;
    occurredSeq?: number;
    documentType?: string;
    documentId?: string;
    externalRef?: string;
    comment?: string;
    userId?: string;
}

/**
 * Создает движение расхода
 * BE-005: Uses advisory lock for stockLocationId-based balance check
 */
export async function createExpenseMovement(
    organizationId: string,
    stockItemId: string,
    quantity: number,
    documentType: string,
    documentId: string,
    userId?: string,  // Made optional for auto operations (REL-105)
    warehouseId: string | null = null,
    comment?: string,
    stockLocationId?: string,
    occurredAt?: Date
) {
    const effectiveOccurredAt = occurredAt || new Date();

    // If stockLocationId is provided, use transactional approach with lock
    if (stockLocationId) {
        return prisma.$transaction(async (tx) => {
            // BE-005: Acquire lock on location
            await acquireLocationLock(tx, stockLocationId, stockItemId);

            // Check balance with lock held
            const balance = await getBalanceAtTx(tx, stockLocationId, stockItemId, effectiveOccurredAt);
            if (balance < quantity) {
                throw new BadRequestError(
                    `Недостаточно топлива на локации. Требуется: ${quantity}, доступно: ${balance}`
                );
            }

            return tx.stockMovement.create({
                data: {
                    organizationId,
                    stockItemId,
                    warehouseId,
                    stockLocationId,
                    movementType: StockMovementType.EXPENSE,
                    quantity,
                    occurredAt: effectiveOccurredAt,
                    documentType,
                    documentId,
                    comment,
                    createdByUserId: userId,
                },
            });
        });
    }

    // Fallback: legacy warehouseId path (no locking)
    const hasEnough = await checkStockAvailability(organizationId, stockItemId, warehouseId, quantity);
    if (!hasEnough) {
        const currentBalance = await getStockBalance(organizationId, stockItemId, warehouseId);
        throw new BadRequestError(
            `Недостаточно топлива на складе. Требуется: ${quantity}, доступно: ${currentBalance}`
        );
    }

    return prisma.stockMovement.create({
        data: {
            organizationId,
            stockItemId,
            warehouseId,
            stockLocationId,
            movementType: StockMovementType.EXPENSE,
            quantity,
            occurredAt: effectiveOccurredAt,
            documentType,
            documentId,
            comment,
            createdByUserId: userId,
        },
    });
}

/**
 * Создает движение прихода на склад
 */
export async function createIncomeMovement(
    organizationId: string,
    stockItemId: string,
    quantity: number,
    documentType: string,
    documentId: string | null,
    userId: string,
    warehouseId: string | null = null,
    comment?: string,
    stockLocationId?: string,
    occurredAt?: Date
) {
    return prisma.stockMovement.create({
        data: {
            organizationId,
            stockItemId,
            warehouseId,
            stockLocationId,
            movementType: StockMovementType.INCOME,
            quantity,
            occurredAt: occurredAt || new Date(),
            documentType,
            documentId,
            comment,
            createdByUserId: userId,
        },
    });
}

