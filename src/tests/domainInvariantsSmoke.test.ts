/// <reference types="vitest" />

import { runDomainInvariants } from '../../services/domain/runDomainInvariants';
import { WaybillStatus } from '../../types';
import type {
    Waybill,
    WaybillBlank,
    GarageStockItem,
    StockTransaction,
    Employee,
    Vehicle,
} from '../../types';

describe('Domain Invariants Smoke', () => {
    it('runs all domain invariants on a consistent snapshot', () => {
        const employees: Employee[] = [
            { id: 'drv1' } as Employee,
        ];

        const vehicles: Vehicle[] = [
            { id: 'veh1' } as Vehicle,
        ];

        const waybills: Waybill[] = [
            {
                id: 'wb1',
                status: WaybillStatus.POSTED,
                blankId: 'blank1',
                driverId: 'drv1',
                vehicleId: 'veh1',
                odometerStart: 1000,
                odometerEnd: 1100,
                fuelAtStart: 10,
                fuelFilled: 0,
                fuelAtEnd: 10, // расход 0, чтобы не требовать складовых транзакций
            } as Waybill,
        ];

        const blanks: WaybillBlank[] = [
            {
                id: 'blank1',
                status: 'used',
                ownerEmployeeId: 'drv1',
                usedInWaybillId: 'wb1',
                usedAt: '2024-01-01T10:00:00Z',
            } as WaybillBlank,
        ];

        const stockItems: GarageStockItem[] = [
            { id: 'item1', balance: 0 } as GarageStockItem,
        ];

        const stockTransactions: StockTransaction[] = [];

        expect(() =>
            runDomainInvariants({
                waybills,
                blanks,
                employees,
                vehicles,
                stockItems,
                stockTransactions,
            }),
        ).not.toThrow();
    });
});
