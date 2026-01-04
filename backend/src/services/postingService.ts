/**
 * POSTING-SVC-010: PostingService
 * Центральный оркестратор для проведения путевых листов.
 * Создаёт StockMovements (TRANSFER/EXPENSE), обновляет бланки и Vehicle.
 */

import { PrismaClient, WaybillStatus, BlankStatus, Prisma } from '@prisma/client';
import { BadRequestError } from '../utils/errors';
import { createTransfer, createExpenseMovement, getBalanceAt } from './stockService';
import { executeStorno } from './stornoService';
import {
    getOrCreateVehicleTankLocation,
    getOrCreateFuelCardLocation,
    getOrCreateDefaultWarehouseLocation,
} from './stockLocationService';

const prisma = new PrismaClient();

// ============================================================================
// Types
// ============================================================================

interface WaybillWithFuelLines {
    id: string;
    number: string;
    organizationId: string;
    vehicleId: string;
    driverId: string;
    departmentId: string | null;
    fuelCardId: string | null;
    blankId: string | null;
    date: Date;
    startAt: Date | null;
    endAt: Date | null;
    odometerStart: any; // Decimal
    odometerEnd: any; // Decimal
    blank: { id: string; status: BlankStatus } | null;
    fuelLines: Array<{
        stockItemId: string;
        fuelStart: any;
        fuelReceived: any;
        fuelConsumed: any;
        fuelEnd: any;
        fuelPlanned: any;
        sourceType: string | null;
        refueledAt: Date | null;
    }>;
}

export interface PostingResult {
    success: boolean;
    waybillId: string;
    transferMovementIds: string[];
    expenseMovementIds: string[];
}

export interface CancelResult {
    success: boolean;
    waybillId: string;
    voidedMovementsCount: number;
}

// ============================================================================
// postWaybill - Выполняет проведение путевого листа
// ============================================================================

/**
 * Выполняет проведение путевого листа:
 * 1. TRANSFER заправок (fuel card / warehouse → vehicle tank)
 * 2. EXPENSE расхода топлива из бака
 * 3. Обновляет статус бланка (ISSUED → USED)
 * 4. Синхронизирует Vehicle (mileage, currentFuel)
 * 
 * @param tx - Prisma транзакция (если вызывается из внешней транзакции)
 * @param waybill - Путевой лист с fuelLines
 * @param effectiveFuelCardId - ID топливной карты (может быть auto-assigned)
 * @param userId - ID пользователя, выполняющего проведение
 */
export async function postWaybill(
    tx: Prisma.TransactionClient,
    waybill: WaybillWithFuelLines,
    effectiveFuelCardId: string | null,
    userId: string
): Promise<PostingResult> {
    const { organizationId, id: waybillId } = waybill;
    const transferMovementIds: string[] = [];
    const expenseMovementIds: string[] = [];

    console.log(`[PostingService] postWaybill started: ${waybill.number}`);

    // 1. Получить локацию бака ТС
    const vehicleTank = await getOrCreateVehicleTankLocation(waybill.vehicleId);

    // 2. TRANSFER заправок в бак
    for (let lineIndex = 0; lineIndex < waybill.fuelLines.length; lineIndex++) {
        const fuelLine = waybill.fuelLines[lineIndex];
        const fuelReceived = Number(fuelLine.fuelReceived || 0);

        if (fuelReceived > 0) {
            // Определяем источник заправки
            let sourceLocationId: string;

            if (effectiveFuelCardId && fuelLine.sourceType !== 'WAREHOUSE') {
                // Заправка с топливной карты
                const cardLocation = await getOrCreateFuelCardLocation(effectiveFuelCardId);
                sourceLocationId = cardLocation.id;
                console.log(`[PostingService] Using fuel card as source: ${effectiveFuelCardId}`);
            } else {
                // Заправка со склада
                const warehouseLocation = await getOrCreateDefaultWarehouseLocation(
                    organizationId,
                    waybill.departmentId
                );
                sourceLocationId = warehouseLocation.id;
            }

            // Время заправки
            const refueledAt = fuelLine.refueledAt || waybill.startAt || waybill.date;

            // IDEMPOTENCY: Уникальный externalRef с версией
            const baseExternalRef = `WB:REFUEL:${waybillId}:${lineIndex}`;
            const voidedCount = await tx.stockMovement.count({
                where: {
                    organizationId,
                    externalRef: { startsWith: baseExternalRef },
                    isVoid: true
                }
            });

            const refuelExternalRef = voidedCount > 0
                ? `${baseExternalRef}:v${voidedCount + 1}`
                : baseExternalRef;

            // Проверка на дубликаты
            const existingRefuel = await tx.stockMovement.findFirst({
                where: {
                    organizationId,
                    externalRef: refuelExternalRef,
                    isVoid: false
                }
            });

            if (existingRefuel) {
                console.log(`[PostingService] Skipping duplicate TRANSFER: ${refuelExternalRef}`);
                transferMovementIds.push(existingRefuel.id);
            } else {
                const transfer = await createTransfer({
                    organizationId,
                    stockItemId: fuelLine.stockItemId,
                    quantity: fuelReceived,
                    fromLocationId: sourceLocationId,
                    toLocationId: vehicleTank.id,
                    occurredAt: refueledAt,
                    occurredSeq: lineIndex * 100,
                    documentType: 'WAYBILL',
                    documentId: waybillId,
                    externalRef: refuelExternalRef,
                    comment: `Заправка по ПЛ №${waybill.number}`,
                    userId,
                });

                // createTransfer returns array of 2 movements (EXPENSE + INCOME)
                if (Array.isArray(transfer)) {
                    transfer.forEach(m => transferMovementIds.push(m.id));
                }
                console.log(`[PostingService] TRANSFER created: ${fuelReceived}L to tank`);
            }
        }
    }

    // 3. EXPENSE расхода топлива из бака
    const expenseOccurredAt = waybill.endAt || waybill.date;

    for (let expenseIndex = 0; expenseIndex < waybill.fuelLines.length; expenseIndex++) {
        const fuelLine = waybill.fuelLines[expenseIndex];

        // Auto-calculate fuelConsumed if missing
        let effectiveFuelConsumed = Number(fuelLine.fuelConsumed || 0);

        if (effectiveFuelConsumed === 0 && fuelLine.fuelStart != null && fuelLine.fuelEnd != null) {
            const fuelStart = Number(fuelLine.fuelStart);
            const fuelReceived = Number(fuelLine.fuelReceived || 0);
            const fuelEnd = Number(fuelLine.fuelEnd);
            const calculatedConsumed = fuelStart + fuelReceived - fuelEnd;

            if (calculatedConsumed > 0) {
                effectiveFuelConsumed = calculatedConsumed;
                console.log(`[PostingService] Auto-calculated fuelConsumed: ${effectiveFuelConsumed}`);
            }
        }

        // Fallback to fuelPlanned
        if (effectiveFuelConsumed === 0 && fuelLine.fuelPlanned != null) {
            const planned = Number(fuelLine.fuelPlanned);
            if (planned > 0) {
                effectiveFuelConsumed = planned;
                console.log(`[PostingService] Using fuelPlanned as fuelConsumed: ${effectiveFuelConsumed}`);
            }
        }

        if (effectiveFuelConsumed > 0) {
            // Validate tank balance before creating EXPENSE
            const tankBalance = await getBalanceAt(vehicleTank.id, fuelLine.stockItemId, expenseOccurredAt);
            const fuelReceived = Number(fuelLine.fuelReceived || 0);
            const effectiveBalance = tankBalance + fuelReceived;

            if (effectiveBalance < effectiveFuelConsumed) {
                throw new BadRequestError(
                    `Недостаточно топлива в баке ТС для проведения ПЛ №${waybill.number}. ` +
                    `Требуется списать: ${effectiveFuelConsumed.toFixed(2)} л, ` +
                    `доступно в баке: ${effectiveBalance.toFixed(2)} л.`,
                    'INSUFFICIENT_TANK_FUEL'
                );
            }

            // Check for existing expense
            const existingExpense = await tx.stockMovement.findFirst({
                where: {
                    organizationId,
                    documentType: 'WAYBILL',
                    documentId: waybillId,
                    movementType: 'EXPENSE',
                    stockLocationId: vehicleTank.id,
                    stockItemId: fuelLine.stockItemId,
                    isVoid: false
                }
            });

            if (existingExpense) {
                console.log(`[PostingService] Skipping duplicate EXPENSE`);
                expenseMovementIds.push(existingExpense.id);
            } else {
                const expense = await createExpenseMovement(
                    organizationId,
                    fuelLine.stockItemId,
                    effectiveFuelConsumed,
                    'WAYBILL',
                    waybillId,
                    userId,
                    null,
                    `Расход по ПЛ №${waybill.number} от ${waybill.date.toISOString().slice(0, 10)}`,
                    vehicleTank.id,
                    expenseOccurredAt
                );

                expenseMovementIds.push(expense.id);
                console.log(`[PostingService] EXPENSE created: ${effectiveFuelConsumed}L`);
            }
        }
    }

    // 4. Обновить статус бланка
    if (waybill.blankId && waybill.blank) {
        const blankStatus = waybill.blank.status;
        if (blankStatus === BlankStatus.ISSUED || blankStatus === BlankStatus.RESERVED) {
            await tx.blank.update({
                where: { id: waybill.blankId },
                data: {
                    status: BlankStatus.USED,
                    usedAt: new Date(),
                },
            });
            console.log(`[PostingService] Blank status updated to USED: ${waybill.blankId}`);
        }
    }

    // 5. Обновить пробег и остаток топлива в справочнике авто
    const fuelEnd = waybill.fuelLines.reduce((acc, fl) => {
        return Number(fl.fuelEnd) || acc;
    }, 0);

    await tx.vehicle.update({
        where: { id: waybill.vehicleId },
        data: {
            ...(waybill.odometerEnd != null && { mileage: waybill.odometerEnd }),
            ...(fuelEnd > 0 && { currentFuel: fuelEnd }),
        }
    });
    console.log(`[PostingService] Vehicle updated: mileage=${waybill.odometerEnd}, fuel=${fuelEnd}`);

    console.log(`[PostingService] postWaybill completed: ${waybill.number}`);

    return {
        success: true,
        waybillId,
        transferMovementIds,
        expenseMovementIds,
    };
}

// ============================================================================
// cancelWaybill - Отменяет проведение (storno)
// ============================================================================

/**
 * Отменяет проведение путевого листа:
 * 1. Rollback Vehicle (mileage, currentFuel)
 * 2. Void stock movements через executeStorno
 * 
 * @param tx - Prisma транзакция
 * @param waybill - Путевой лист с fuelLines
 * @param reason - Причина отмены
 * @param userId - ID пользователя
 */
export async function cancelWaybill(
    tx: Prisma.TransactionClient,
    waybill: WaybillWithFuelLines,
    reason: string,
    userId: string
): Promise<CancelResult> {
    const { organizationId, id: waybillId } = waybill;

    console.log(`[PostingService] cancelWaybill started: ${waybill.number}`);

    // 1. Rollback Vehicle mileage and fuel
    if (waybill.vehicleId) {
        const fuelStart = waybill.fuelLines.length > 0
            ? Number(waybill.fuelLines[0].fuelStart || 0)
            : 0;

        await tx.vehicle.update({
            where: { id: waybill.vehicleId },
            data: {
                mileage: waybill.odometerStart || 0,
                currentFuel: fuelStart,
            }
        });
        console.log(`[PostingService] Vehicle rolled back: mileage=${waybill.odometerStart}, fuel=${fuelStart}`);
    }

    // 2. Execute storno for stock movements
    let voidedMovementsCount = 0;
    try {
        const stornoResult = await executeStorno(
            tx,
            organizationId,
            'WAYBILL',
            waybillId,
            reason || 'Корректировка ПЛ',
            userId
        );
        voidedMovementsCount = stornoResult.originalMovementsCount;
    } catch (err) {
        // Ignore 404 if no movements found
        if ((err as any).statusCode === 404) {
            console.warn('[PostingService] No movements found to storno');
        } else {
            throw err;
        }
    }

    console.log(`[PostingService] cancelWaybill completed: ${waybill.number}, voided ${voidedMovementsCount} movements`);

    return {
        success: true,
        waybillId,
        voidedMovementsCount,
    };
}
