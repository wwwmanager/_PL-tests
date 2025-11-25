// services/domain/runDomainInvariants.ts
import type {
    Waybill,
    WaybillBlank,
    Employee,
    Vehicle,
    GarageStockItem,
    StockTransaction,
} from '../../types';
import { assertWaybillInvariants, InvariantHelpers } from './waybillInvariants';
import { assertBlankInvariants } from './blankInvariants';
import { assertStockInvariants } from './stockInvariants';
import { assertFuelCardInvariants } from './fuelCardInvariants';

export interface DomainSnapshot {
    waybills: Waybill[];
    blanks: WaybillBlank[];
    employees: Employee[];
    vehicles: Vehicle[];
    stockItems: GarageStockItem[];
    stockTransactions: StockTransaction[];
}

/**
 * Запускает все доменные инварианты на одном "снимке" данных.
 */
export function runDomainInvariants(snapshot: DomainSnapshot): void {
    const {
        waybills,
        blanks,
        employees,
        vehicles,
        stockItems,
        stockTransactions,
    } = snapshot;

    // 1. Инварианты для каждого ПЛ
    for (const waybill of waybills) {
        const helpers: InvariantHelpers = {
            findBlankById: (id) => blanks.find((b) => b.id === id),
            findStockTxById: (id) => stockTransactions.find((t) => t.id === id),
            getAllStockTx: () => stockTransactions,
            getVehicleById: (id) => vehicles.find((v) => v.id === id),
        };

        assertWaybillInvariants(waybill, helpers);
    }

    // 2. Инварианты бланков
    assertBlankInvariants({
        blanks,
        waybills,
        employees,
    });

    // 3. Инварианты склада
    assertStockInvariants({
        stockItems,
        stockTransactions,
    });

    // 4. Инварианты топливных карт
    assertFuelCardInvariants({
        employees,
        waybills,
        stockTransactions,
    });
}
