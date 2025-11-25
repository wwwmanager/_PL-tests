/// <reference types="vitest" />

import { assertBlankInvariants } from './blankInvariants';
import type { WaybillBlank, Waybill, Employee } from '../../types';
import { WaybillStatus } from '../../types';

describe('blankInvariants', () => {
    it('does not throw for consistent blanks', () => {
        const employees: Employee[] = [
            { id: 'drv1' } as Employee,
        ];

        const waybills: Waybill[] = [
            {
                id: 'wb-draft',
                status: WaybillStatus.DRAFT,
                blankId: 'blank-reserved',
            } as Waybill,
            {
                id: 'wb-posted',
                status: WaybillStatus.POSTED,
                blankId: 'blank-used',
            } as Waybill,
        ];

        const blanks: WaybillBlank[] = [
            {
                id: 'blank-issued',
                status: 'issued',
                ownerEmployeeId: 'drv1',
            } as WaybillBlank,
            {
                id: 'blank-reserved',
                status: 'reserved',
                ownerEmployeeId: 'drv1',
                reservedByWaybillId: 'wb-draft',
            } as WaybillBlank,
            {
                id: 'blank-used',
                status: 'used',
                ownerEmployeeId: 'drv1',
                usedInWaybillId: 'wb-posted',
            } as WaybillBlank,
            {
                id: 'blank-available',
                status: 'available',
            } as WaybillBlank,
            {
                id: 'blank-spoiled',
                status: 'spoiled',
            } as WaybillBlank,
        ];

        expect(() =>
            assertBlankInvariants({ blanks, waybills, employees }),
        ).not.toThrow();
    });

    it('detects inconsistent reserved and used blanks', () => {
        const employees: Employee[] = [
            { id: 'drv1' } as Employee,
        ];

        const waybills: Waybill[] = [
            {
                id: 'wb-cancelled',
                status: WaybillStatus.CANCELLED,
                blankId: 'blank-reserved-bad',
            } as Waybill,
            {
                id: 'wb-not-posted',
                status: WaybillStatus.DRAFT,
                blankId: 'blank-used-bad',
            } as Waybill,
        ];

        const blanks: WaybillBlank[] = [
            // reserved без ПЛ
            {
                id: 'blank-reserved-no-wb',
                status: 'reserved',
                ownerEmployeeId: 'drv1',
            } as WaybillBlank,
            // reserved с отменённым ПЛ
            {
                id: 'blank-reserved-bad',
                status: 'reserved',
                ownerEmployeeId: 'drv1',
                reservedByWaybillId: 'wb-cancelled',
            } as WaybillBlank,
            // used без ПЛ
            {
                id: 'blank-used-no-wb',
                status: 'used',
                ownerEmployeeId: 'drv1',
            } as WaybillBlank,
            // used с не-POSTED ПЛ
            {
                id: 'blank-used-bad',
                status: 'used',
                ownerEmployeeId: 'drv1',
                usedInWaybillId: 'wb-not-posted',
            } as WaybillBlank,
            // статус issued, но без водителя
            {
                id: 'blank-issued-no-driver',
                status: 'issued',
            } as WaybillBlank,
        ];

        expect(() =>
            assertBlankInvariants({ blanks, waybills, employees }),
        ).toThrowError(/Нарушение инвариантов бланков:/);
    });
});
