// services/domain/fuelCardInvariants.ts
import type { Employee, Waybill, StockTransaction } from '../../types';
import { WaybillStatus } from '../../types';

interface FuelCardInvariantContext {
    employees: Employee[];
    waybills: Waybill[];
    stockTransactions: StockTransaction[];
}

/**
 * Человекочитаемое обозначение сотрудника/водителя:
 * - ФИО (например, "Иванов И.И.")
 * - или ID в fallback-случае
 */
function formatEmployeeLabel(emp: Employee): string {
    return emp.fullName || `Сотрудник (ID: ${emp.id})`;
}

function calcWaybillConsumption(waybill: Waybill): number {
    const fuelAtStart = waybill.fuelAtStart ?? 0;
    const fuelFilled = waybill.fuelFilled ?? 0;
    const fuelAtEnd = waybill.fuelAtEnd ?? 0;
    const consumption = fuelAtStart + fuelFilled - fuelAtEnd;
    return consumption > 0 ? consumption : 0;
}

/**
 * Рассчитывает количество топлива, заправленного с топливной карты водителя.
 * Это именно fuelFilled, а не общий расход топлива.
 */
function calcFuelCardUsage(waybill: Waybill): number {
    const fuelFilled = waybill.fuelFilled ?? 0;
    return fuelFilled > 0 ? fuelFilled : 0;
}

export function assertFuelCardInvariants(ctx: FuelCardInvariantContext): void {
    const { employees, waybills, stockTransactions } = ctx;
    const errors: string[] = [];

    // 1. Топапы по водителям (fuelCardTopUp)
    const topUpsByDriver = new Map<string, number>();

    for (const tx of stockTransactions) {
        if (tx.expenseReason !== 'fuelCardTopUp') continue;

        const txLabel = tx.docNumber
            ? `Пополнение топливной карты ${tx.docNumber}`
            : `Пополнение топливной карты (ID: ${tx.id ?? '<no-id>'})`;

        if (!tx.driverId) {
            errors.push(`${txLabel}: не указан водитель (driverId).`);
            continue;
        }

        const driver = employees.find((e) => e.id === tx.driverId);
        if (!driver) {
            errors.push(
                `${txLabel}: указан водитель, но такой сотрудник не найден.`,
            );
            continue;
        }

        // В транзакциях типа 'expense' (расход со склада) quantity находится внутри items
        // Но для fuelCardTopUp мы обычно смотрим на items[0].quantity, так как это пополнение карты
        // В текущей реализации StockTransaction:
        // items: StockTransactionItem[];
        // StockTransactionItem { quantity: number; ... }

        // Просуммируем количество из всех items этой транзакции (обычно там один item - топливо)
        let txQty = 0;
        if (tx.items && tx.items.length > 0) {
            txQty = tx.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
        } else {
            // Fallback если вдруг quantity есть на самой транзакции (в старых типах могло быть)
            // Но в текущем типе StockTransaction quantity нет на верхнем уровне.
            // Оставим 0 если items пуст.
        }

        if (txQty <= 0) {
            errors.push(`${txLabel}: количество должно быть больше 0 (сейчас ${txQty.toFixed(2)}).`);
            continue;
        }

        topUpsByDriver.set(
            tx.driverId,
            (topUpsByDriver.get(tx.driverId) ?? 0) + txQty,
        );
    }

    // 2. Суммарный расход с топливной карты по POSTED ПЛ по водителям
    const consumptionByDriver = new Map<string, number>();

    for (const wb of waybills) {
        if (wb.status !== WaybillStatus.POSTED) continue;
        if (!wb.driverId) continue;

        // Используем новую функцию для расчета расхода с карты (только fuelFilled)
        const cardUsage = calcFuelCardUsage(wb);
        if (cardUsage <= 0) continue;

        consumptionByDriver.set(
            wb.driverId,
            (consumptionByDriver.get(wb.driverId) ?? 0) + cardUsage,
        );
    }

    // 3. Сверяем ожидаемый и фактический баланс по каждому водителю
    for (const emp of employees) {
        const driverId = emp.id;
        const label = formatEmployeeLabel(emp);

        const topUps = topUpsByDriver.get(driverId) ?? 0;
        const cons = consumptionByDriver.get(driverId) ?? 0;
        const hasActivity = topUps !== 0 || cons !== 0;

        // Если нет ни одного топапа и ни одного проведённого ПЛ —
        // считаем, что баланс мог быть стартовым/импортированным → не трогаем.
        if (!hasActivity) continue;

        const actual = emp.fuelCardBalance ?? 0;
        const expected = topUps - cons;
        const diff = Math.abs(actual - expected);
        const EPS = 1e-6;

        if (actual < 0) {
            errors.push(
                `Водитель ${label}: баланс топливной карты не может быть отрицательным (сейчас ${actual.toFixed(2)}).`,
            );
        }

        if (diff > EPS) {
            errors.push(
                `Водитель ${label}: ожидаемый баланс топливной карты ${expected.toFixed(2)}, ` +
                `в карточке сотрудника указано ${actual.toFixed(2)}. Возможно, баланс был изменён вручную.`,
            );
        }
    }

    if (errors.length) {
        throw new Error(
            'Нарушение инвариантов топливных карт:\n' + errors.join('\n'),
        );
    }
}
