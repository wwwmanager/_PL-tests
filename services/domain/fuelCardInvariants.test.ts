/// <reference types="vitest" />

import { assertFuelCardInvariants } from './fuelCardInvariants';
import type { Employee, Waybill, StockTransaction } from '../../types';
import { WaybillStatus } from '../../types';

describe('fuelCardInvariants', () => {
    it('does not throw for consistent fuel card balances', () => {
        const employees: Employee[] = [
            {
                id: 'drv1',
                fuelCardBalance: 70,
            } as Employee,
        ];

        const waybills: Waybill[] = [
            {
                id: 'wb1',
                driverId: 'drv1',
                status: WaybillStatus.POSTED,
                fuelAtStart: 0,
                fuelFilled: 30,
                fuelAtEnd: 0, // расход 30
            } as Waybill,
        ];

        const stockTransactions: StockTransaction[] = [
            {
                id: 'tx1',
                type: 'expense',
                expenseReason: 'fuelCardTopUp',
                driverId: 'drv1',
                items: [{ stockItemId: 'item1', quantity: 100 }],
            } as StockTransaction,
        ];

        // Ожидаемый баланс: 100 - 30 = 70
        expect(() =>
            assertFuelCardInvariants({ employees, waybills, stockTransactions }),
        ).not.toThrow();
    });

    it('detects manual changes of fuel card balance', () => {
        const employees: Employee[] = [
            {
                id: 'drv1',
                fuelCardBalance: 20, // должно быть 70, как в предыдущем сценарии
            } as Employee,
        ];

        const waybills: Waybill[] = [
            {
                id: 'wb1',
                driverId: 'drv1',
                status: WaybillStatus.POSTED,
                fuelAtStart: 0,
                fuelFilled: 30,
                fuelAtEnd: 0,
            } as Waybill,
        ];

        const stockTransactions: StockTransaction[] = [
            {
                id: 'tx1',
                type: 'expense',
                expenseReason: 'fuelCardTopUp',
                driverId: 'drv1',
                items: [{ stockItemId: 'item1', quantity: 100 }],
            } as StockTransaction,
        ];

        expect(() =>
            assertFuelCardInvariants({ employees, waybills, stockTransactions }),
        ).toThrowError(/Нарушение инвариантов топливных карт:/);
    });
});
