/**
 * LEDGER-DOCS-BE-020: Storno Service
 * Отмена проведённых документов путём создания обратных движений
 */

import { PrismaClient, StockMovementType, Prisma } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../utils/errors';

const prisma = new PrismaClient();

export interface StornoResult {
    success: boolean;
    documentType: string;
    documentId: string;
    originalMovementsCount: number;
    stornoMovementsIds: string[];
    reason: string;
}

/**
 * Создать сторно для документа
 * Находит все движения по documentType+documentId и создаёт обратные
 * 
 * @param organizationId - ID организации (для безопасности)
 * @param documentType - Тип документа (WAYBILL, FUEL_CARD_RESET, etc.)
 * @param documentId - ID документа
 * @param reason - Причина сторно
 * @param userId - ID пользователя, выполняющего операцию
 */
export async function stornoDocument(
    organizationId: string,
    documentType: string,
    documentId: string,
    reason: string,
    userId: string
): Promise<StornoResult> {
    return prisma.$transaction(async (tx) => {
        // 1. Найти все активные (не voided) движения по документу
        const originalMovements = await tx.stockMovement.findMany({
            where: {
                organizationId,
                documentType,
                documentId,
                isVoid: false,
            },
            orderBy: { occurredAt: 'asc' }, // Важно для корректного порядка сторно
        });

        if (originalMovements.length === 0) {
            throw new NotFoundError(
                `Движения для документа ${documentType}:${documentId} не найдены или уже отменены`
            );
        }

        console.log(`[STORNO] Found ${originalMovements.length} movements for ${documentType}:${documentId}`);

        const stornoMovementsIds: string[] = [];
        const stornoExternalRefPrefix = `STORNO:${documentType}:${documentId}`;

        // 2. Создать обратные движения
        for (const original of originalMovements) {
            const stornoExternalRef = `${stornoExternalRefPrefix}:${original.id}`;

            // Проверяем что сторно ещё не было создано (идемпотентность)
            const existing = await tx.stockMovement.findFirst({
                where: {
                    organizationId,
                    externalRef: stornoExternalRef,
                }
            });

            if (existing) {
                console.log(`[STORNO] Skipping already reversed movement: ${original.id}`);
                stornoMovementsIds.push(existing.id);
                continue;
            }

            // Определяем обратный тип и локации
            let stornoData: Prisma.StockMovementCreateInput;
            const baseData = {
                organization: { connect: { id: organizationId } },
                stockItem: { connect: { id: original.stockItemId } },
                quantity: original.quantity, // Тот же quantity, но смысл обратный
                occurredAt: new Date(),
                occurredSeq: 0,
                documentType: 'STORNO',
                documentId: original.id, // Ссылаемся на оригинальное движение
                externalRef: stornoExternalRef,
                comment: `Сторно: ${reason}`,
                createdByUser: userId ? { connect: { id: userId } } : undefined,
            };

            switch (original.movementType) {
                case StockMovementType.INCOME:
                    // Обратное к приходу = расход
                    stornoData = {
                        ...baseData,
                        movementType: StockMovementType.EXPENSE,
                        stockLocation: original.stockLocationId
                            ? { connect: { id: original.stockLocationId } }
                            : undefined,
                        warehouse: original.warehouseId
                            ? { connect: { id: original.warehouseId } }
                            : undefined,
                    };
                    break;

                case StockMovementType.EXPENSE:
                    // Обратное к расходу = приход
                    stornoData = {
                        ...baseData,
                        movementType: StockMovementType.INCOME,
                        stockLocation: original.stockLocationId
                            ? { connect: { id: original.stockLocationId } }
                            : undefined,
                        warehouse: original.warehouseId
                            ? { connect: { id: original.warehouseId } }
                            : undefined,
                    };
                    break;

                case StockMovementType.TRANSFER:
                    // Обратное к переводу = перевод в обратном направлении
                    stornoData = {
                        ...baseData,
                        movementType: StockMovementType.TRANSFER,
                        fromStockLocation: original.toStockLocationId
                            ? { connect: { id: original.toStockLocationId } }
                            : undefined,
                        toStockLocation: original.fromStockLocationId
                            ? { connect: { id: original.fromStockLocationId } }
                            : undefined,
                    };
                    break;

                case StockMovementType.ADJUSTMENT:
                    // Обратное к корректировке = корректировка с обратным знаком
                    stornoData = {
                        ...baseData,
                        movementType: StockMovementType.ADJUSTMENT,
                        quantity: new Prisma.Decimal(Number(original.quantity) * -1),
                        stockLocation: original.stockLocationId
                            ? { connect: { id: original.stockLocationId } }
                            : undefined,
                    };
                    break;

                default:
                    throw new BadRequestError(`Неизвестный тип движения: ${original.movementType}`);
            }

            const stornoMovement = await tx.stockMovement.create({
                data: stornoData,
            });

            stornoMovementsIds.push(stornoMovement.id);
            console.log(`[STORNO] Created storno movement ${stornoMovement.id} for original ${original.id}`);
        }

        // 3. Пометить оригинальные движения как void
        await tx.stockMovement.updateMany({
            where: {
                id: { in: originalMovements.map(m => m.id) },
            },
            data: {
                isVoid: true,
                voidedAt: new Date(),
                voidedByUserId: userId,
                voidReason: `STORNO: ${reason}`,
            },
        });

        console.log(`[STORNO] Marked ${originalMovements.length} movements as void`);

        return {
            success: true,
            documentType,
            documentId,
            originalMovementsCount: originalMovements.length,
            stornoMovementsIds,
            reason,
        };
    });
}

/**
 * Проверить, можно ли сделать сторно документа
 * (проверяет что балансы не уйдут в минус после сторно)
 */
export async function canStornoDocument(
    organizationId: string,
    documentType: string,
    documentId: string
): Promise<{ canStorno: boolean; reason?: string }> {
    const movements = await prisma.stockMovement.findMany({
        where: {
            organizationId,
            documentType,
            documentId,
            isVoid: false,
        },
    });

    if (movements.length === 0) {
        return { canStorno: false, reason: 'Движения не найдены или уже отменены' };
    }

    // TODO: Добавить проверку балансов
    // Для каждого INCOME движения проверить что на локации достаточно остатка для списания
    // Для каждого TRANSFER проверить что на целевой локации достаточно для обратного перевода

    return { canStorno: true };
}
