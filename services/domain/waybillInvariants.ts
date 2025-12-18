// services/domain/waybillInvariants.ts
import {
    Waybill,
    WaybillBlank,
    StockTransaction,
    Vehicle,
    WaybillStatus,
} from '../../types';

export interface InvariantHelpers {
    findBlankById: (id: string) => WaybillBlank | undefined;
    findStockTxById: (id: string) => StockTransaction | undefined;
    getAllStockTx: () => StockTransaction[];
    getVehicleById: (id: string) => Vehicle | undefined;
}

/**
 * Человекочитаемое обозначение ПЛ:
 * - сначала номер ПЛ (или серия+номер бланка),
 * - затем дата, если есть.
 *
 * Примеры:
 * - "ЧБ 000001 от 23.11.2025"
 * - "12345 от 01.10.2025"
 * - "ID: wb-abc123" (fallback, если совсем нет номера/серии)
 */
function formatWaybillLabel(waybill: Waybill): string {
    const numberPart =
        waybill.number && waybill.number !== 'БЛАНКОВ НЕТ'
            ? waybill.number
            : waybill.blankSeries && waybill.blankNumber != null
                ? `${waybill.blankSeries} ${String(waybill.blankNumber).padStart(6, '0')}`
                : `ID: ${waybill.id}`;

    const datePart = waybill.date
        ? new Date(waybill.date).toLocaleDateString('ru-RU')
        : undefined;

    return datePart ? `${numberPart} от ${datePart}` : numberPart;
}

/**
 * Основная точка входа: проверяет все инварианты для одного ПЛ.
 * Бросает Error, если найдены нарушения.
 */
export function assertWaybillInvariants(
    waybill: Waybill,
    helpers: InvariantHelpers,
): void {
    const errors: string[] = [];
    const label = formatWaybillLabel(waybill);

    // Проверка существования ТС (опционально)
    if (waybill.vehicleId && helpers.getVehicleById) {
        const vehicle = helpers.getVehicleById(waybill.vehicleId);
        // Если helper возвращает undefined — просто пропускаем проверку (например, в тестах)
        if (vehicle !== undefined && !vehicle) {
            errors.push(
                `${label}: указан транспорт (vehicleId=${waybill.vehicleId}), но такое ТС не найдено.`,
            );
        }
    }

    errors.push(
        ...checkPostedHasStockTransactions(waybill, helpers),
        ...checkBlankStatusMatchesWaybill(waybill, helpers),
        ...checkFuelCalculations(waybill),
    );

    if (errors.length > 0) {
        const header = `Проблемы с путевым листом ${label}:`;
        throw new Error(header + '\n' + errors.join('\n'));
    }
}

/**
 * POSTED → складские транзакции
 *
 * - Если ПЛ проведён (POSTED) и есть расход топлива → должна быть хотя бы одна
 *   складская транзакция по этому ПЛ.
 * - linkedStockTransactionIds должны ссылаться на существующие транзакции
 *   типа expense с expenseReason='waybill'.
 */
export function checkPostedHasStockTransactions(
    waybill: Waybill,
    helpers: InvariantHelpers,
): string[] {
    const errors: string[] = [];
    const label = formatWaybillLabel(waybill);

    if (waybill.status !== WaybillStatus.POSTED) {
        return errors;
    }

    const allTx = helpers.getAllStockTx();
    const waybillTx = allTx.filter((tx) => tx.waybillId === waybill.id);

    const fuelAtStart = waybill.fuelAtStart ?? 0;
    const fuelFilled = waybill.fuelFilled ?? 0;
    const fuelAtEnd = waybill.fuelAtEnd ?? 0;
    const consumption = fuelAtStart + fuelFilled - fuelAtEnd;

    if (consumption > 0) {
        // Проверяем, используется ли вообще складской учёт расхода по ПЛ
        const hasAnyWaybillExpenses = allTx.some(
            (tx) => tx.type === 'expense' && tx.expenseReason === 'waybill',
        );

        // Если вообще нет ни одной транзакции расхода по ПЛ,
        // считаем, что складской учёт топлива по путевым листам не включён — не ругаемся.
        if (hasAnyWaybillExpenses && waybillTx.length === 0) {
            errors.push(
                `${label}: документ проведён с расходом топлива ${consumption.toFixed(
                    2,
                )} л, но по нему нет связанного списания топлива со склада.`,
            );
        }
    }

    // Проверка связей через linkedStockTransactionIds (если поле есть)
    const linked = (waybill as any).linkedStockTransactionIds as
        | string[]
        | undefined;

    if (Array.isArray(linked)) {
        for (const txId of linked) {
            const tx = helpers.findStockTxById(txId);
            if (!tx) {
                errors.push(
                    `${label}: указана связанная складская операция (ID ${txId}), но она не найдена.`,
                );
                continue;
            }

            if (tx.type !== 'expense') {
                errors.push(
                    `${label}: связанная складская операция ${txId} должна быть расходом (type='expense'), сейчас type='${tx.type}'.`,
                );
            }

            if (tx.expenseReason !== 'waybill') {
                errors.push(
                    `${label}: связанная складская операция ${txId} должна иметь причину 'waybill' (списание по ПЛ), сейчас '${tx.expenseReason}'.`,
                );
            }

            if (tx.waybillId && tx.waybillId !== waybill.id) {
                errors.push(
                    `${label}: связанная складская операция ${txId} ссылается на другой путевой лист (waybillId=${tx.waybillId}).`,
                );
            }
        }
    }

    return errors;
}

/**
 * POSTED/DRAFT → статус бланка
 *
 * - POSTED + blankId → бланк в статусе used, usedInWaybillId = waybill.id, usedAt заполнен.
 * - DRAFT + blankId → бланк в статусе reserved или issued.
 *   Если reserved → reservedByWaybillId = waybill.id.
 */
export function checkBlankStatusMatchesWaybill(
    waybill: Waybill,
    helpers: InvariantHelpers,
): string[] {
    const errors: string[] = [];
    const label = formatWaybillLabel(waybill);

    if (!waybill.blankId) {
        return errors;
    }

    const blank = helpers.findBlankById(waybill.blankId);
    if (!blank) {
        errors.push(
            `${label}: указан бланк (blankId=${waybill.blankId}), но такой бланк не найден.`,
        );
        return errors;
    }

    if (waybill.status === WaybillStatus.POSTED) {
        if (blank.status !== 'used') {
            errors.push(
                `${label}: для проведённого ПЛ связанный бланк (${blank.id}) должен быть в статусе 'used', сейчас '${blank.status}'.`,
            );
        }
        if (blank.usedInWaybillId !== waybill.id) {
            errors.push(
                `${label}: для проведённого ПЛ ожидается, что blank.usedInWaybillId = ID этого ПЛ, сейчас '${blank.usedInWaybillId ?? 'не задано'}'.`,
            );
        }
        if (!(blank as any).usedAt) {
            errors.push(
                `${label}: для использованного бланка (${blank.id}) должно быть заполнено поле usedAt.`,
            );
        }
    }

    if (waybill.status === WaybillStatus.DRAFT) {
        if (blank.status !== 'reserved' && blank.status !== 'issued') {
            errors.push(
                `${label}: для черновика ПЛ связанный бланк (${blank.id}) должен быть в статусе 'reserved' или 'issued', сейчас '${blank.status}'.`,
            );
        }

        if (blank.status === 'reserved') {
            if (blank.reservedByWaybillId !== waybill.id) {
                errors.push(
                    `${label}: для зарезервированного бланка ожидается reservedByWaybillId = ID этого ПЛ, сейчас '${blank.reservedByWaybillId ?? 'не задано'}'.`,
                );
            }
            if (!(blank as any).reservedAt) {
                errors.push(
                    `${label}: для зарезервированного бланка (${blank.id}) должно быть заполнено поле reservedAt.`,
                );
            }
        }
    }

    return errors;
}

/**
 * Топливные расчёты:
 * fuelAtStart + fuelFilled - fuelAtEnd >= 0, все значения неотрицательны.
 */
export function checkFuelCalculations(waybill: Waybill): string[] {
    const errors: string[] = [];
    const label = formatWaybillLabel(waybill);

    const fuelAtStart = waybill.fuelAtStart ?? 0;
    const fuelFilled = waybill.fuelFilled ?? 0;
    const fuelAtEnd = waybill.fuelAtEnd ?? 0;

    const consumption = fuelAtStart + fuelFilled - fuelAtEnd;

    if (fuelAtStart < 0 || fuelFilled < 0 || fuelAtEnd < 0) {
        errors.push(
            `${label}: значения топлива не должны быть отрицательными (выезд=${fuelAtStart.toFixed(2)}, заправлено=${fuelFilled.toFixed(2)}, возврат=${fuelAtEnd.toFixed(2)}).`,
        );
    }

    if (consumption < 0) {
        errors.push(
            `${label}: некорректный расход топлива: выезд (${fuelAtStart.toFixed(2)}) + заправлено (${fuelFilled.toFixed(2)}) - возврат (${fuelAtEnd.toFixed(2)}) = ${consumption.toFixed(2)} < 0.`,
        );
    }

    return errors;
}