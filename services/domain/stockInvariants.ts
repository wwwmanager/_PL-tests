// services/domain/stockInvariants.ts
import type { GarageStockItem, StockTransaction } from '../../types';

interface StockInvariantContext {
    stockItems: GarageStockItem[];
    stockTransactions: StockTransaction[];
}

/**
 * Человекочитаемое обозначение складской номенклатуры:
 * - наименование (например, "Топливо АИ-92 (л)")
 * - или ID в fallback-случае
 */
function formatStockItemLabel(item: GarageStockItem): string {
    return item.name ?? `Номенклатура (ID: ${item.id})`;
}

export function assertStockInvariants(ctx: StockInvariantContext): void {
    const { stockItems, stockTransactions } = ctx;
    const errors: string[] = [];

    const itemsById = new Map<string, GarageStockItem>();
    for (const item of stockItems) {
        if (!item.id) continue;
        itemsById.set(item.id, item);
    }

    // Аккумулируем по номенклатуре сумму приходов/расходов
    const aggregates = new Map<
        string,
        {
            net: number;   // income - expense
            hasTx: boolean;
        }
    >();

    const getAgg = (id: string) => {
        let agg = aggregates.get(id);
        if (!agg) {
            agg = { net: 0, hasTx: false };
            aggregates.set(id, agg);
        }
        return agg;
    };

    for (const tx of stockTransactions) {
        const txLabel = tx.docNumber
            ? `Складская операция ${tx.docNumber}`
            : `Складская операция (ID: ${tx.id ?? '<no-id>'})`;

        // Проверяем items внутри транзакции
        if (!tx.items || tx.items.length === 0) {
            errors.push(
                `${txLabel}: не указаны позиции (items) в операции.`,
            );
            continue;
        }

        for (const txItem of tx.items) {
            if (txItem.quantity == null || txItem.quantity <= 0) {
                errors.push(
                    `${txLabel}: количество должно быть больше 0 (сейчас ${txItem.quantity.toFixed(2)}).`,
                );
                continue;
            }

            if (!txItem.stockItemId) {
                errors.push(
                    `${txLabel}: не указана номенклатура (stockItemId).`,
                );
                continue;
            }

            const item = itemsById.get(txItem.stockItemId);
            if (!item) {
                errors.push(
                    `${txLabel}: указана номенклатура, но она не найдена на складе.`,
                );
                continue;
            }

            const agg = getAgg(txItem.stockItemId);
            agg.hasTx = true;

            if (tx.type === 'income') {
                agg.net += txItem.quantity;
            } else if (tx.type === 'expense') {
                agg.net -= txItem.quantity;
            } else {
                errors.push(
                    `${txLabel}: неизвестный тип операции (type=${(tx as any).type}).`,
                );
            }
        }
    }

    // Проверяем сами номенклатуры
    for (const item of stockItems) {
        const label = formatStockItemLabel(item);

        const balance = item.balance ?? 0;
        if (balance < 0) {
            errors.push(
                `${label}: остаток на складе не может быть отрицательным (сейчас ${balance.toFixed(2)}).`,
            );
        }

        const agg = aggregates.get(item.id!);
        if (agg && agg.hasTx) {
            // Сверяем расчётный баланс из транзакций и сохранённый balance
            const diff = Math.abs(balance - agg.net);
            const EPS = 1e-6;
            if (diff > EPS) {
                errors.push(
                    `${label}: сумма по операциям прихода/расхода составляет ${agg.net.toFixed(2)}, но в карточке номенклатуры указан остаток ${balance.toFixed(2)}.`,
                );
            }
        }
    }

    if (errors.length) {
        throw new Error(
            'Нарушение инвариантов склада:\n' + errors.join('\n'),
        );
    }
}
