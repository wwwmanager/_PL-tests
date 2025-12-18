/**
 * WB-801: Unit tests for dateUtils - isWinterDate function
 */

import { describe, it, expect } from 'vitest';
import { isWinterDate } from './dateUtils';
import { SeasonSettings } from '../services/settingsService';

describe('isWinterDate', () => {
    describe('recurring settings', () => {
        const recurringSettings: SeasonSettings = {
            type: 'recurring',
            summerDay: 1,
            summerMonth: 4,    // April
            winterDay: 1,
            winterMonth: 11    // November
        };

        it('should return true for January (winter)', () => {
            expect(isWinterDate('2024-01-15', recurringSettings)).toBe(true);
        });

        it('should return true for February (winter)', () => {
            expect(isWinterDate('2024-02-28', recurringSettings)).toBe(true);
        });

        it('should return true for March 31 (last day before summer)', () => {
            expect(isWinterDate('2024-03-31', recurringSettings)).toBe(true);
        });

        it('should return false for April 1 (first day of summer)', () => {
            expect(isWinterDate('2024-04-01', recurringSettings)).toBe(false);
        });

        it('should return false for June (summer)', () => {
            expect(isWinterDate('2024-06-15', recurringSettings)).toBe(false);
        });

        it('should return false for October 31 (last day before winter)', () => {
            expect(isWinterDate('2024-10-31', recurringSettings)).toBe(false);
        });

        it('should return true for November 1 (first day of winter)', () => {
            expect(isWinterDate('2024-11-01', recurringSettings)).toBe(true);
        });

        it('should return true for December (winter)', () => {
            expect(isWinterDate('2024-12-25', recurringSettings)).toBe(true);
        });
    });

    describe('manual settings', () => {
        const manualSettings: SeasonSettings = {
            type: 'manual',
            winterStartDate: '2024-11-01',
            winterEndDate: '2025-03-31'
        };

        it('should return true for November 1, 2024 (first day)', () => {
            expect(isWinterDate('2024-11-01', manualSettings)).toBe(true);
        });

        it('should return true for December in winter period', () => {
            expect(isWinterDate('2024-12-15', manualSettings)).toBe(true);
        });

        it('should return true for January 2025 in winter period', () => {
            expect(isWinterDate('2025-01-10', manualSettings)).toBe(true);
        });

        it('should return true for March 31, 2025 (last day)', () => {
            expect(isWinterDate('2025-03-31', manualSettings)).toBe(true);
        });

        it('should return false for October 31, 2024 (before winter)', () => {
            expect(isWinterDate('2024-10-31', manualSettings)).toBe(false);
        });

        it('should return false for April 1, 2025 (after winter)', () => {
            expect(isWinterDate('2025-04-01', manualSettings)).toBe(false);
        });
    });

    describe('edge cases', () => {
        const recurringSettings: SeasonSettings = {
            type: 'recurring',
            summerDay: 1,
            summerMonth: 4,
            winterDay: 1,
            winterMonth: 11
        };

        it('should return false for empty date string', () => {
            expect(isWinterDate('', recurringSettings)).toBe(false);
        });

        it('should return false for invalid date string', () => {
            expect(isWinterDate('invalid', recurringSettings)).toBe(false);
        });

        it('should return false for null settings', () => {
            expect(isWinterDate('2024-01-15', null as any)).toBe(false);
        });
    });
});
