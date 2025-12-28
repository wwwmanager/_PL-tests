import { PrismaClient, StockMovementType, Prisma, AuditActionType } from '@prisma/client';
import { BadRequestError, NotFoundError, ConflictError } from '../utils/errors';

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
 * P0-4: STOCK-PERIOD-LOCK — Check if the period is locked for this organization
 * @param tx - Transaction client
 * @param organizationId - Organization ID
 * @param occurredAt - Date of the movement
 */
async function checkPeriodLock(
    tx: Prisma.TransactionClient,
    organizationId: string,
    occurredAt: Date
): Promise<void> {
    const org = await tx.organization.findUnique({
        where: { id: organizationId },
        select: { stockLockedAt: true }
    });

    if (org?.stockLockedAt && occurredAt <= org.stockLockedAt) {
        throw new ConflictError(
            `Период складского учёта закрыт до ${org.stockLockedAt.toLocaleString()}. ` +
            `Нельзя создавать или изменять движения в закрытом периоде.`
        );
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
            where: { stockLocationId, stockItemId, movementType: StockMovementType.INCOME, isVoid: false, occurredAt: { lte: asOf } },
            _sum: { quantity: true },
        }),
        tx.stockMovement.aggregate({
            where: { stockLocationId, stockItemId, movementType: StockMovementType.EXPENSE, isVoid: false, occurredAt: { lte: asOf } },
            _sum: { quantity: true },
        }),
        tx.stockMovement.aggregate({
            where: { stockLocationId, stockItemId, movementType: StockMovementType.ADJUSTMENT, isVoid: false, occurredAt: { lte: asOf } },
            _sum: { quantity: true },
        }),
        tx.stockMovement.aggregate({
            where: { toStockLocationId: stockLocationId, stockItemId, movementType: StockMovementType.TRANSFER, isVoid: false, occurredAt: { lte: asOf } },
            _sum: { quantity: true },
        }),
        tx.stockMovement.aggregate({
            where: { fromStockLocationId: stockLocationId, stockItemId, movementType: StockMovementType.TRANSFER, isVoid: false, occurredAt: { lte: asOf } },
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
                isVoid: false,
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
                isVoid: false,
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
                isVoid: false,
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
                isVoid: false,
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
                isVoid: false,
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
    stockItemId: string;
    stockItemName: string;
    unit: string;
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
    // Получаем информацию о товаре
    const stockItem = await prisma.stockItem.findUnique({
        where: { id: stockItemId },
        select: { name: true, unit: true }
    });

    if (!stockItem) {
        return [];
    }

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

    console.log(`[getBalancesAt] Found ${locations.length} active locations for org ${organizationId}`);

    // Параллельно считаем баланс каждой локации
    const balances = await Promise.all(
        locations.map(async (loc) => ({
            locationId: loc.id,
            locationName: loc.name,
            locationType: loc.type,
            stockItemId, // Add stockItemId for frontend filtering
            stockItemName: stockItem.name,
            unit: stockItem.unit,
            balance: await getBalanceAt(loc.id, stockItemId, asOf),
        }))
    );

    // Filter out locations with 0 balance to reduce noise
    return balances.filter(b => Math.abs(b.balance) > 0.001);
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

        // P0-4: Period lock check
        await checkPeriodLock(tx, organizationId, occurredAt);

        // Check balance with lock held
        const sourceBalance = await getBalanceAtTx(tx, fromLocationId, stockItemId, occurredAt);

        if (sourceBalance < quantity) {
            throw new BadRequestError(
                `Недостаточно топлива на локации-источнике (Loc: ${fromLocationId}, StockItem: ${stockItemId}). Требуется: ${quantity}, доступно: ${sourceBalance} на дату ${occurredAt.toISOString()}`
            );
        }

        // Create TRANSFER movement
        const movement = await tx.stockMovement.create({
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

        // SYNC-FUEL-CARD: Update legacy FuelCard.balanceLiters if locations are linked to cards
        // 1. Get location details to check if they are FUEL_CARD type
        const [fromLoc, toLoc] = await Promise.all([
            tx.stockLocation.findUnique({ where: { id: fromLocationId } }),
            tx.stockLocation.findUnique({ where: { id: toLocationId } })
        ]);

        // 2. Decrement Source Card
        if (fromLoc?.type === 'FUEL_CARD' && fromLoc.fuelCardId) {
            await tx.fuelCard.update({
                where: { id: fromLoc.fuelCardId },
                data: { balanceLiters: { decrement: quantity } }
            });
        }

        // 3. Increment Dest Card
        if (toLoc?.type === 'FUEL_CARD' && toLoc.fuelCardId) {
            await tx.fuelCard.update({
                where: { id: toLoc.fuelCardId },
                data: { balanceLiters: { increment: quantity } }
            });
        }

        return movement;
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

            // P0-4: Period lock check
            await checkPeriodLock(tx, organizationId, occurredAt);

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

    // Positive adjustment doesn't need balance-locking but MUST check period lock
    return prisma.$transaction(async (tx) => {
        await checkPeriodLock(tx, organizationId, occurredAt);

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
        where: {
            ...where,
            isVoid: false,
        },
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

            // P0-4: Period lock check — must be inside transaction
            await checkPeriodLock(tx, organizationId, effectiveOccurredAt);

            // Check balance with lock held
            const balance = await getBalanceAtTx(tx, stockLocationId, stockItemId, effectiveOccurredAt);
            if (balance < quantity) {
                throw new BadRequestError(
                    `Недостаточно топлива на локации (Loc: ${stockLocationId}, StockItem: ${stockItemId}). Требуется: ${quantity}, доступно: ${balance} на дату ${effectiveOccurredAt.toISOString()}`
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
        if (currentBalance < quantity) {
            throw new BadRequestError(
                `Недостаточно топлива на складе (Loc: ${stockLocationId}, StockItem: ${stockItemId}). Требуется: ${quantity}, доступно: ${currentBalance} на дату ${occurredAt ? occurredAt.toISOString() : 'CURRENT'}`
            );
        }
    }

    return prisma.$transaction(async (tx) => {
        // P0-4: Period lock check
        await checkPeriodLock(tx, organizationId, effectiveOccurredAt);

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
    const effectiveOccurredAt = occurredAt || new Date();
    return prisma.$transaction(async (tx) => {
        // P0-4: Period lock check
        await checkPeriodLock(tx, organizationId, effectiveOccurredAt);

        return tx.stockMovement.create({
            data: {
                organizationId,
                stockItemId,
                warehouseId,
                stockLocationId,
                movementType: StockMovementType.INCOME,
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

// ============================================================================
// REL-102: UPDATE operation
// ============================================================================

export interface UpdateMovementParams {
    id: string;
    organizationId: string;
    userId: string;
    // Fields that can be updated
    occurredAt?: Date;
    movementType?: StockMovementType;
    stockItemId?: string;
    quantity?: number;
    stockLocationId?: string; // For INCOME/EXPENSE
    fromLocationId?: string;  // For TRANSFER
    toLocationId?: string;    // For TRANSFER
    externalRef?: string;
    comment?: string;
}

/**
 * Обновить существующее движение
 * Сложная логика:
 * 1. Получаем старую версию
 * 2. Блокируем все затронутые локации (старые и новые)
 * 3. Откатываем старое движение (проверяем баланс если это был приход)
 * 4. Накатываем новое движение (проверяем баланс если это расход)
 * 5. Обновляем запись
 */
export async function updateStockMovement(params: UpdateMovementParams) {
    const { id, organizationId, userId, ...updates } = params;

    return prisma.$transaction(async (tx) => {
        // 1. Get current state
        const original = await tx.stockMovement.findUnique({
            where: { id }
        });

        if (!original || original.organizationId !== organizationId) {
            throw new NotFoundError('Движение не найдено');
        }

        // P0-3: STOCK-UPDATE-GUARD — Prevent editing automated system movements
        if (original.documentType !== null) {
            throw new BadRequestError(
                'Нельзя редактировать системные движения. ' +
                `documentType: ${original.documentType}. ` +
                'Если нужна корректировка — создайте void + новое движение через API.'
            );
        }

        // Determine all locations involved (old and new) to lock involved resources
        const locationIds = new Set<string>();

        // Add old locations
        if (original.stockLocationId) locationIds.add(original.stockLocationId);
        if (original.fromStockLocationId) locationIds.add(original.fromStockLocationId);
        if (original.toStockLocationId) locationIds.add(original.toStockLocationId);

        // Add new locations from updates
        if (updates.stockLocationId) locationIds.add(updates.stockLocationId);
        if (updates.fromLocationId) locationIds.add(updates.fromLocationId);
        if (updates.toLocationId) locationIds.add(updates.toLocationId);

        // Filter out null/undefined and convert to array
        const locksToAcquire = Array.from(locationIds).filter(Boolean) as string[];

        // Determine affected stock items (old and new)
        // Ideally we should lock (location, item) pairs, but acquireLocationLocks takes (location[], item)
        // If stockItemId changes, we must lock for both items.
        // For simplicity, let's assume stockItemId change is rare or we handle it by locking twice.
        // Current helper acquireLocationLocks takes a single stockItemId.
        // We will lock for original.stockItemId. If new one is different, we lock for that too.

        await acquireLocationLocks(tx, locksToAcquire, original.stockItemId);
        if (updates.stockItemId && updates.stockItemId !== original.stockItemId) {
            await acquireLocationLocks(tx, locksToAcquire, updates.stockItemId);
        }

        // P0-4: Period lock check (check BOTH original and new date)
        await checkPeriodLock(tx, organizationId, original.occurredAt);
        if (updates.occurredAt && updates.occurredAt.getTime() !== original.occurredAt.getTime()) {
            await checkPeriodLock(tx, organizationId, updates.occurredAt);
        }

        // --- REVERT OLD MOVEMENT EFFECT ---
        // This is tricky. We need to check if reverting causes negative balance for some cases.
        // Reverting INCOME -> behave like EXPENSE (check balance)
        // Reverting EXPENSE -> behave like INCOME (safe)
        // Reverting TRANSFER -> check balance at 'to' location because we are taking it back? 
        // No, reverting TRANSFER means moving back from TO to FROM. So check balance at TO.

        const oldQty = Number(original.quantity);
        const oldItem = original.stockItemId;

        if (original.movementType === StockMovementType.INCOME) {
            // Revert INCOME = deduct from location
            if (original.stockLocationId) {
                const bal = await getBalanceAtTx(tx, original.stockLocationId, oldItem, new Date());
                if (bal < oldQty) {
                    throw new BadRequestError(`Невозможно отменить приход: недостаточно товара на остатке для списания (${bal} < ${oldQty})`);
                }
            }
        } else if (original.movementType === StockMovementType.TRANSFER) {
            // Revert TRANSFER = move from TO back to FROM
            // Check if TO location has enough to send back
            if (original.toStockLocationId) {
                const bal = await getBalanceAtTx(tx, original.toStockLocationId, oldItem, new Date());
                if (bal < oldQty) {
                    throw new BadRequestError(`Невозможно изменить перемещение: на целевом складе уже нет достаточного количества (${bal} < ${oldQty})`);
                }
            }
        }
        // EXPENSE revert = add back (safe)
        // ADJUSTMENT revert = subtract quantity (if positive) or add (if negative). if subtracting, check balance.
        else if (original.movementType === StockMovementType.ADJUSTMENT) {
            if (oldQty > 0 && original.stockLocationId) {
                const bal = await getBalanceAtTx(tx, original.stockLocationId, oldItem, new Date());
                if (bal < oldQty) {
                    throw new BadRequestError(`Невозможно отменить корректировку (+): недостаточно товара на остатке (${bal} < ${oldQty})`);
                }
            }
            // negative adjustment revert is safe (adding back)
        }

        // --- APPLY NEW MOVEMENT EFFECT ---
        // Now valid checks for the new state. 
        // Note: We haven't actually changed DB yet, so "current balance" includes the old movement.
        // We need to calculate the *net* effect or simulate the state after revert.

        // Let's create the update data object
        const newData = {
            movementType: updates.movementType || original.movementType,
            quantity: updates.quantity !== undefined ? updates.quantity : Number(original.quantity),
            stockItemId: updates.stockItemId || original.stockItemId,
            stockLocationId: updates.stockLocationId ?? original.stockLocationId,
            fromStockLocationId: updates.fromLocationId ?? original.fromStockLocationId,
            toStockLocationId: updates.toLocationId ?? original.toStockLocationId,
            occurredAt: updates.occurredAt || original.occurredAt,
        };

        // If simple update (just comment/ref), skip heavy logic
        const isLogicChange =
            newData.movementType !== original.movementType ||
            newData.quantity !== Number(original.quantity) ||
            newData.stockItemId !== original.stockItemId ||
            newData.stockLocationId !== original.stockLocationId ||
            newData.fromStockLocationId !== original.fromStockLocationId ||
            newData.toStockLocationId !== original.toStockLocationId ||
            newData.occurredAt.getTime() !== original.occurredAt.getTime();

        if (!isLogicChange) {
            return tx.stockMovement.update({
                where: { id },
                data: {
                    externalRef: updates.externalRef,
                    comment: updates.comment
                }
            });
        }

        // Validate new parameters
        if (newData.movementType === StockMovementType.TRANSFER) {
            if (!newData.fromStockLocationId || !newData.toStockLocationId) {
                throw new BadRequestError('Для перемещения (TRANSFER) требуются fromLocationId и toLocationId');
            }
        } else {
            // For others, stockLocationId is usually required (unless legacy warehouseId - but we are V2 now)
            if (!newData.stockLocationId) {
                throw new BadRequestError('Не указана локация (stockLocationId)');
            }
        }

        // Perform validation for the NEW operation "Check availability" 
        // We must take into account that the OLD operation is effectively gone.
        // Balance available for new op = CurrentBalance - (Effect of Old Op)

        // Define helper to get "Virtual Balance" (balance without the old movement effect)
        const getVirtualBalance = async (locId: string, itemId: string) => {
            const current = await getBalanceAtTx(tx, locId, itemId, newData.occurredAt); // check at new date

            // Remove old effect if it affected this location/item
            let correction = 0;
            if (original.stockItemId === itemId) {
                // Calculate effect of original movement on this location
                if (original.movementType === StockMovementType.INCOME && original.stockLocationId === locId) {
                    correction = oldQty; // It added Qty, so 'without it' means -Qty
                } else if (original.movementType === StockMovementType.EXPENSE && original.stockLocationId === locId) {
                    correction = -oldQty; // It subs Qty, so 'without it' means +Qty
                } else if (original.movementType === StockMovementType.ADJUSTMENT && original.stockLocationId === locId) {
                    correction = oldQty; // Added (pos or neg), so 'without it' means -Qty
                } else if (original.movementType === StockMovementType.TRANSFER) {
                    if (original.fromStockLocationId === locId) correction = -oldQty;
                    if (original.toStockLocationId === locId) correction = oldQty;
                }
            }

            // Virtual Balance = Current - Effect
            // If effect was +10, current includes +10. Virtual = Current - 10.
            return current - correction;
        };

        // Now validate NEW operation against Virtual Balance
        if (newData.movementType === StockMovementType.EXPENSE) {
            const bal = await getVirtualBalance(newData.stockLocationId!, newData.stockItemId);
            if (bal < newData.quantity) {
                throw new BadRequestError(`Недостаточно товара (Expense). Доступно: ${bal}, Требуется: ${newData.quantity}`);
            }
        } else if (newData.movementType === StockMovementType.TRANSFER) {
            const bal = await getVirtualBalance(newData.fromStockLocationId!, newData.stockItemId);
            if (bal < newData.quantity) {
                throw new BadRequestError(`Недостаточно товара (Transfer). Доступно: ${bal}, Требуется: ${newData.quantity}`);
            }
        } else if (newData.movementType === StockMovementType.ADJUSTMENT) {
            if (newData.quantity < 0) {
                const bal = await getVirtualBalance(newData.stockLocationId!, newData.stockItemId);
                if (bal + newData.quantity < 0) {
                    throw new BadRequestError(`Корректировка приведёт к отрицательному остатку. Доступно: ${bal}, Корректировка: ${newData.quantity}`);
                }
            }
        }

        // 5. Update Record
        const updatedMovement = await tx.stockMovement.update({
            where: { id },
            data: {
                movementType: newData.movementType,
                quantity: newData.quantity,
                stockItemId: newData.stockItemId,
                stockLocationId: newData.stockLocationId,
                fromStockLocationId: newData.fromStockLocationId,
                toStockLocationId: newData.toStockLocationId,
                occurredAt: newData.occurredAt,
                externalRef: updates.externalRef,
                comment: updates.comment,
            }
        });

        // SYNC-FUEL-CARD: Update legacy FuelCard.balanceLiters
        // Helper to update card balance
        const updateCardBalance = async (locId: string | null | undefined, delta: number) => {
            if (!locId) return;
            const loc = await tx.stockLocation.findUnique({ where: { id: locId } });
            if (loc?.type === 'FUEL_CARD' && loc.fuelCardId) {
                await tx.fuelCard.update({
                    where: { id: loc.fuelCardId },
                    data: { balanceLiters: { increment: delta } }
                });
            }
        };

        // 1. REVERT effect of old movement on cards
        if (original.movementType === StockMovementType.TRANSFER) {
            // Transfer: FROM -qty, TO +qty.  Revert: FROM +qty, TO -qty
            await updateCardBalance(original.fromStockLocationId, oldQty);
            await updateCardBalance(original.toStockLocationId, -oldQty);
        } else if (original.movementType === StockMovementType.INCOME) {
            // Income: +qty. Revert: -qty
            await updateCardBalance(original.stockLocationId, -oldQty);
        } else if (original.movementType === StockMovementType.EXPENSE) {
            // Expense: -qty. Revert: +qty
            await updateCardBalance(original.stockLocationId, oldQty);
        }

        // 2. APPLY effect of new movement on cards
        const newQty = newData.quantity;
        if (newData.movementType === StockMovementType.TRANSFER) {
            // Transfer: FROM -qty, TO +qty
            await updateCardBalance(newData.fromStockLocationId, -newQty);
            await updateCardBalance(newData.toStockLocationId, newQty);
        } else if (newData.movementType === StockMovementType.INCOME) {
            // Income: +qty
            await updateCardBalance(newData.stockLocationId, newQty);
        } else if (newData.movementType === StockMovementType.EXPENSE) {
            // Expense: -qty
            await updateCardBalance(newData.stockLocationId, -newQty);
        }

        return updatedMovement;
    });
}

// ============================================================================
// P1-1: STOCK-VOID — Soft void for manual movements
// ============================================================================

/**
 * Check if voiding a movement would cause negative balance in the future
 * STOCK-VOID-CHECK-003: Walks through future movements to ensure no hidden negatives
 * 
 * @param tx - Transaction client
 * @param movement - The movement being voided
 * @param affectedLocationId - Which location to check (for TRANSFER, this is toLocation)
 */
async function assertNonNegativeAfterVoid(
    tx: Prisma.TransactionClient,
    movement: any,
    affectedLocationId: string
): Promise<void> {
    const { stockItemId, occurredAt, occurredSeq, quantity } = movement;

    // Calculate delta (voiding reverses the original effect)
    let voidDelta = 0;
    if (movement.movementType === StockMovementType.INCOME) {
        voidDelta = -Number(quantity); // Was +qty, now -qty
    } else if (movement.movementType === StockMovementType.EXPENSE) {
        voidDelta = Number(quantity); // Was -qty, now +qty (safe)
    } else if (movement.movementType === StockMovementType.ADJUSTMENT) {
        voidDelta = -Number(quantity);
    } else if (movement.movementType === StockMovementType.TRANSFER) {
        // For toLocation: was +qty, now -qty
        if (affectedLocationId === movement.toStockLocationId) {
            voidDelta = -Number(quantity);
        }
        // For fromLocation: was -qty, now +qty (safe)
        else {
            return; // No check needed for from location
        }
    }

    // If voiding increases balance, it's always safe
    if (voidDelta >= 0) return;

    // Get all future movements (after occurredAt/occurredSeq) on this location
    const futureMovements = await tx.stockMovement.findMany({
        where: {
            stockItemId,
            isVoid: false,
            AND: [
                {
                    OR: [
                        { stockLocationId: affectedLocationId },
                        { fromStockLocationId: affectedLocationId },
                        { toStockLocationId: affectedLocationId },
                    ],
                },
                {
                    OR: [
                        { occurredAt: { gt: occurredAt } },
                        {
                            occurredAt: occurredAt,
                            occurredSeq: { gt: occurredSeq || 0 }
                        },
                    ],
                },
            ],
        },
        orderBy: [
            { occurredAt: 'asc' },
            { occurredSeq: 'asc' },
        ],
    });

    // Start with balance AT occurredAt (includes this movement)
    let runningBalance = await getBalanceAtTx(tx, affectedLocationId, stockItemId, occurredAt);

    // Remove the original movement effect (since we're calculating as if it's voided)
    if (movement.movementType === StockMovementType.INCOME && movement.stockLocationId === affectedLocationId) {
        runningBalance -= Number(quantity);
    } else if (movement.movementType === StockMovementType.EXPENSE && movement.stockLocationId === affectedLocationId) {
        runningBalance += Number(quantity);
    } else if (movement.movementType === StockMovementType.ADJUSTMENT && movement.stockLocationId === affectedLocationId) {
        runningBalance -= Number(quantity);
    } else if (movement.movementType === StockMovementType.TRANSFER) {
        if (movement.fromStockLocationId === affectedLocationId) {
            runningBalance += Number(quantity);
        }
        if (movement.toStockLocationId === affectedLocationId) {
            runningBalance -= Number(quantity);
        }
    }

    // Check if current state (immediately after void) is already negative
    if (runningBalance < 0) {
        throw new BadRequestError(
            `Voiding would create negative balance immediately. ` +
            `Balance after void: ${runningBalance.toFixed(3)}`
        );
    }

    // Walk through future movements and check running balance
    for (const futureMove of futureMovements) {
        // Apply this future movement
        if (futureMove.movementType === StockMovementType.INCOME && futureMove.stockLocationId === affectedLocationId) {
            runningBalance += Number(futureMove.quantity);
        } else if (futureMove.movementType === StockMovementType.EXPENSE && futureMove.stockLocationId === affectedLocationId) {
            runningBalance -= Number(futureMove.quantity);
        } else if (futureMove.movementType === StockMovementType.ADJUSTMENT && futureMove.stockLocationId === affectedLocationId) {
            runningBalance += Number(futureMove.quantity);
        } else if (futureMove.movementType === StockMovementType.TRANSFER) {
            if (futureMove.fromStockLocationId === affectedLocationId) {
                runningBalance -= Number(futureMove.quantity);
            }
            if (futureMove.toStockLocationId === affectedLocationId) {
                runningBalance += Number(futureMove.quantity);
            }
        }

        // Check for negative
        if (runningBalance < 0) {
            throw new BadRequestError(
                `Voiding would cause negative balance in the future. ` +
                `At movement ${futureMove.id} (${futureMove.occurredAt.toISOString()}): ` +
                `balance would be ${runningBalance.toFixed(3)}`
            );
        }
    }
}

export interface VoidMovementParams {
    id: string;
    organizationId: string;
    userId: string;
    reason: string;
}

/**
 * Void a manual stock movement (soft delete)
 * Guards:
 * - Only manual movements (documentType IS NULL)
 * - Not already voided
 * - Period lock check (TODO PR3)
 * - Future non-negative balance check
 */
export async function voidStockMovement(params: VoidMovementParams) {
    const { id, organizationId, userId, reason } = params;

    return await prisma.$transaction(async (tx) => {
        // 1. Get movement
        const movement = await tx.stockMovement.findFirst({
            where: { id, organizationId },
        });

        if (!movement) {
            throw new NotFoundError('Movement not found');
        }

        // 2. Guard: Only manual movements (no documentType)
        if (movement.documentType !== null) {
            throw new BadRequestError(
                `Cannot void system movement. documentType: ${movement.documentType}. ` +
                'System movements are immutable.'
            );
        }

        // 3. Guard: Already voided
        if (movement.isVoid) {
            throw new BadRequestError('Movement is already voided');
        }

        // 4. P0-4: Period lock check
        await checkPeriodLock(tx, organizationId, movement.occurredAt);

        // 5. Guard: Future non-negative check (STOCK-VOID-CHECK-003)
        // For TRANSFER: check toLocation (loses quantity when voided)
        // For other types: determine affected location
        if (movement.movementType === StockMovementType.TRANSFER) {
            // Check toLocation (where quantity will be removed)
            if (movement.toStockLocationId) {
                await assertNonNegativeAfterVoid(tx, movement, movement.toStockLocationId);
            }
            // fromLocation gains back quantity (always safe, no check needed)
        } else {
            // For INCOME, EXPENSE, ADJUSTMENT - determine affected location
            let affectedLocationId: string | null = null;

            if (movement.movementType === StockMovementType.INCOME && movement.stockLocationId) {
                affectedLocationId = movement.stockLocationId;
            } else if (movement.movementType === StockMovementType.EXPENSE && movement.stockLocationId) {
                affectedLocationId = movement.stockLocationId; // Usually safe (adds back)
            } else if (movement.movementType === StockMovementType.ADJUSTMENT && movement.stockLocationId) {
                affectedLocationId = movement.stockLocationId;
            }

            if (affectedLocationId) {
                await assertNonNegativeAfterVoid(tx, movement, affectedLocationId);
            }
        }

        // 6. Void movement
        const voided = await tx.stockMovement.update({
            where: { id },
            data: {
                isVoid: true,
                voidedAt: new Date(),
                voidedByUserId: userId,
                voidReason: reason,
            },
        });

        // Legacy FuelCard.balanceLiters sync disabled (STOCK-VOID-LEGACY-005)
        // We are transitioning to "ledger is source of truth"
        // FuelCard.balanceLiters should be computed from StockMovement ledger
        // TODO TECH-DEBT: Remove balanceLiters column entirely in future migration

        // 7. Audit log
        await tx.auditLog.create({
            data: {
                organizationId,
                userId,
                actionType: AuditActionType.UPDATE,
                entityType: 'StockMovement',
                entityId: id,
                description: `Voided stock movement: ${reason}`,
                oldValue: { isVoid: false },
                newValue: { isVoid: true, voidedAt: voided.voidedAt, voidReason: reason },
            },
        });

        return voided;
    });
}


