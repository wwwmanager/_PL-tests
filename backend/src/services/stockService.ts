import { PrismaClient, StockMovementType, Prisma } from '@prisma/client';
import { BadRequestError } from '../utils/errors';

const prisma = new PrismaClient();

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
 * Проверяет наличие достаточного количества на источнике
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

    // Проверяем наличие на источнике
    const sourceBalance = await getBalanceAt(fromLocationId, stockItemId, occurredAt);

    if (sourceBalance < quantity) {
        throw new BadRequestError(
            `Недостаточно топлива на локации-источнике. Требуется: ${quantity}, доступно: ${sourceBalance}`
        );
    }

    // Создаём движение TRANSFER
    return prisma.stockMovement.create({
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
    // Если указан stockLocationId, проверяем баланс через новую систему
    if (stockLocationId) {
        const balance = await getBalanceAt(stockLocationId, stockItemId, occurredAt || new Date());
        if (balance < quantity) {
            throw new BadRequestError(
                `Недостаточно топлива на локации. Требуется: ${quantity}, доступно: ${balance}`
            );
        }
    } else {
        // Fallback на старую проверку
        const hasEnough = await checkStockAvailability(organizationId, stockItemId, warehouseId, quantity);
        if (!hasEnough) {
            const currentBalance = await getStockBalance(organizationId, stockItemId, warehouseId);
            throw new BadRequestError(
                `Недостаточно топлива на складе. Требуется: ${quantity}, доступно: ${currentBalance}`
            );
        }
    }

    return prisma.stockMovement.create({
        data: {
            organizationId,
            stockItemId,
            warehouseId,
            stockLocationId,
            movementType: StockMovementType.EXPENSE,
            quantity,
            occurredAt: occurredAt || new Date(),
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

