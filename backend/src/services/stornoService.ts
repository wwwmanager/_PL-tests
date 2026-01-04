/**
 * LEDGER-DOCS-BE-020: Storno Service
 * Отмена проведённых документов путём пометки isVoid=true
 * 
 * ВАЖНО: Мы используем "soft void" подход - НЕ создаём обратные записи,
 * а просто помечаем оригинальные движения как void.
 */

import { PrismaClient, StockMovementType, Prisma } from '@prisma/client';
import { NotFoundError } from '../utils/errors';

const prisma = new PrismaClient();

export interface StornoResult {
    success: boolean;
    documentType: string;
    documentId: string;
    originalMovementsCount: number;
    stornoMovementsIds: string[]; // теперь пустой массив (обратные записи не создаются)
    reason: string;
}

export async function stornoDocument(
    organizationId: string,
    documentType: string,
    documentId: string,
    reason: string,
    userId: string
): Promise<StornoResult> {
    return prisma.$transaction(async (tx) => {
        return executeStorno(tx as any, organizationId, documentType, documentId, reason, userId);
    });
}

/**
 * Внутренняя логика сторно - помечает движения как void БЕЗ создания обратных записей
 * 
 * ИЗМЕНЕНО: Ранее создавались обратные движения + void. Теперь только void.
 * Причина: При повторном проведении ПЛ обратные записи оставались активными,
 * что приводило к накоплению ошибок в балансах.
 */
export async function executeStorno(
    tx: Prisma.TransactionClient,
    organizationId: string,
    documentType: string,
    documentId: string,
    reason: string,
    userId: string
): Promise<StornoResult> {
    // 1. Найти все активные (не voided) движения по документу
    const originalMovements = await tx.stockMovement.findMany({
        where: {
            organizationId,
            documentType,
            documentId,
            isVoid: false,
        },
        orderBy: { occurredAt: 'asc' },
    });

    if (originalMovements.length === 0) {
        throw new NotFoundError(
            `Движения для документа ${documentType}:${documentId} не найдены или уже отменены`
        );
    }

    console.log(`[STORNO] Found ${originalMovements.length} movements for ${documentType}:${documentId}`);

    // 2. Пометить все движения как void (БЕЗ создания обратных записей)
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

    console.log(`[STORNO] Marked ${originalMovements.length} movements as void (no reverse entries created)`);

    // 3. Также пометить как void любые СТАРЫЕ сторно-записи для этого документа
    // (на случай если были созданы по старой логике)
    const stornoPrefix = `STORNO:${documentType}:${documentId}`;
    const oldStornoRecords = await tx.stockMovement.updateMany({
        where: {
            organizationId,
            externalRef: { startsWith: stornoPrefix },
            isVoid: false,
        },
        data: {
            isVoid: true,
            voidedAt: new Date(),
            voidedByUserId: userId,
            voidReason: `CLEANUP: ${reason}`,
        },
    });

    if (oldStornoRecords.count > 0) {
        console.log(`[STORNO] Also voided ${oldStornoRecords.count} old storno records`);
    }

    return {
        success: true,
        documentType,
        documentId,
        originalMovementsCount: originalMovements.length,
        stornoMovementsIds: [], // Теперь не создаём обратные записи
        reason,
    };
}

/**
 * Проверить, можно ли сделать сторно документа
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

    return { canStorno: true };
}
