import { PrismaClient, StockMovementType } from '@prisma/client';
import { BadRequestError } from '../utils/errors';

const prisma = new PrismaClient();

/**
 * Проверяет наличие достаточного количества товара на складе
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
        }
        // ADJUSTMENT может быть положительным или отрицательным - для простоты пока игнорируем
    }

    return balance;
}

/**
 * Создает движение расхода со склада
 */
export async function createExpenseMovement(
    organizationId: string,
    stockItemId: string,
    quantity: number,
    documentType: string,
    documentId: string,
    userId: string,
    warehouseId: string | null = null,
    comment?: string
) {
    // Проверяем наличие товара
    const hasEnough = await checkStockAvailability(
        organizationId,
        stockItemId,
        warehouseId,
        quantity
    );

    if (!hasEnough) {
        const currentBalance = await getStockBalance(organizationId, stockItemId, warehouseId);
        throw new BadRequestError(
            `Недостаточно топлива на складе. Требуется: ${quantity}, доступно: ${currentBalance}`
        );
    }

    // Создаем запись расхода
    return prisma.stockMovement.create({
        data: {
            organizationId,
            stockItemId,
            warehouseId,
            movementType: StockMovementType.EXPENSE,
            quantity,
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
    comment?: string
) {
    return prisma.stockMovement.create({
        data: {
            organizationId,
            stockItemId,
            warehouseId,
            movementType: StockMovementType.INCOME,
            quantity,
            documentType,
            documentId,
            comment,
            createdByUserId: userId,
        },
    });
}
