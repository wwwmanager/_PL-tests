/// <reference types="vitest" />

import { assertStockInvariants } from './stockInvariants';
import type { GarageStockItem, StockTransaction } from '../../types';

describe('stockInvariants', () => {
    it('does not throw for consistent stock data', () => {
        const stockItems: GarageStockItem[] = [
            // Номенклатура с транзакциями
            {
                id: 'item-1',
                balance: 10,
            } as GarageStockItem,
            // Номенклатура без транзакций, но с балансом (стартовый остаток)
            {
                id: 'item-2',
                balance: 5,
            } as GarageStockItem,
            // Номенклатура с нулевым балансом и без транзакций
            {
                id: 'item-3',
                balance: 0,
            } as GarageStockItem,
        ];

        const stockTransactions: StockTransaction[] = [
            {
                id: 'tx-1',
                type: 'income',
                items: [
                    {
                        stockItemId: 'item-1',
                        quantity: 7,
                    },
                ],
            } as StockTransaction,
            {
                id: 'tx-2',
                type: 'income',
                items: [
                    {
                        stockItemId: 'item-1',
                        quantity: 3,
                    },
                ],
            } as StockTransaction,
        ];

        expect(() =>
            assertStockInvariants({ stockItems, stockTransactions }),
        ).not.toThrow();
    });

    it('detects inconsistent stock data', () => {
        const stockItems: GarageStockItem[] = [
            {
                id: 'item-neg',
                balance: -1,
            } as GarageStockItem,
            {
                id: 'item-mismatch',
                balance: 10,
            } as GarageStockItem,
        ];

        const stockTransactions: StockTransaction[] = [
            // Неверное количество
            {
                id: 'tx-bad-qty',
                type: 'income',
                items: [
                    {
                        stockItemId: 'item-mismatch',
                        quantity: 0,
                    },
                ],
            } as StockTransaction,
            // Ссылка на несуществующий item
            {
                id: 'tx-no-item',
                type: 'expense',
                items: [
                    {
                        stockItemId: 'missing-item',
                        quantity: 5,
                    },
                ],
            } as StockTransaction,
            // Несогласованный баланс (net = 5, balance = 10)
            {
                id: 'tx-mismatch',
                type: 'income',
                items: [
                    {
                        stockItemId: 'item-mismatch',
                        quantity: 5,
                    },
                ],
            } as StockTransaction,
        ];

        expect(() =>
            assertStockInvariants({ stockItems, stockTransactions }),
        ).toThrowError(/Нарушение инвариантов склада:/);
    });
});
