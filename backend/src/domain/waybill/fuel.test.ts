/**
 * WB-801: Unit tests for fuel calculation functions
 */

import { describe, it, expect } from 'vitest';
import {
    calculateDistanceKm,
    calculateNormConsumption,
    calculatePlannedFuel,
    calculateFuelEnd,
    validateFuelBalance,
    validateOdometer,
    FuelConsumptionRates,
    DrivingFlags
} from './fuel';

describe('calculateDistanceKm', () => {
    it('should calculate correct distance', () => {
        expect(calculateDistanceKm(1000, 1050)).toBe(50);
    });

    it('should return 0 for same odometer values', () => {
        expect(calculateDistanceKm(1000, 1000)).toBe(0);
    });

    it('should return null for null start', () => {
        expect(calculateDistanceKm(null, 1050)).toBeNull();
    });

    it('should return null for null end', () => {
        expect(calculateDistanceKm(1000, null)).toBeNull();
    });

    it('should return null for negative distance', () => {
        expect(calculateDistanceKm(1050, 1000)).toBeNull();
    });
});

describe('calculateNormConsumption', () => {
    it('should calculate simple consumption without coefficients', () => {
        expect(calculateNormConsumption(100, 10, {})).toBe(10);
    });

    it('should apply winter coefficient', () => {
        expect(calculateNormConsumption(100, 10, { winter: 0.1 })).toBe(11);
    });

    it('should apply multiple coefficients', () => {
        expect(calculateNormConsumption(100, 20, { winter: 0.1, city: 0.05 })).toBe(23);
    });

    it('should return 0 for zero distance', () => {
        expect(calculateNormConsumption(0, 15, { winter: 0.1 })).toBe(0);
    });

    it('should round to 2 decimals', () => {
        expect(calculateNormConsumption(123, 10.5, {})).toBe(12.92);
    });

    it('should handle city + warming coefficients', () => {
        expect(calculateNormConsumption(50, 10, { city: 0.15, warming: 0.1 })).toBe(6.25);
    });
});

describe('calculatePlannedFuel', () => {
    const rates: FuelConsumptionRates = {
        winterRate: 12,
        summerRate: 10,
        cityIncreasePercent: 15,
        warmingIncreasePercent: 10
    };

    it('should use summer rate when not winter', () => {
        expect(calculatePlannedFuel(100, rates, {}, false)).toBe(10);
    });

    it('should use winter rate when winter', () => {
        expect(calculatePlannedFuel(100, rates, {}, true)).toBe(12);
    });

    it('should apply city driving flag', () => {
        const flags: DrivingFlags = { isCityDriving: true };
        expect(calculatePlannedFuel(100, rates, flags, false)).toBe(11.5);
    });

    it('should apply warming flag', () => {
        const flags: DrivingFlags = { isWarming: true };
        expect(calculatePlannedFuel(100, rates, flags, true)).toBe(13.2);
    });

    it('should apply both flags', () => {
        const flags: DrivingFlags = { isCityDriving: true, isWarming: true };
        expect(calculatePlannedFuel(100, rates, flags, false)).toBe(12.5);
    });

    it('should return 0 for null rates', () => {
        expect(calculatePlannedFuel(100, null, {}, false)).toBe(0);
    });

    it('should return 0 for empty rates', () => {
        expect(calculatePlannedFuel(100, {}, {}, false)).toBe(0);
    });
});

describe('calculateFuelEnd', () => {
    it('should calculate fuel end correctly', () => {
        expect(calculateFuelEnd(50, 30, 25)).toBe(55);
    });

    it('should treat null values as 0', () => {
        expect(calculateFuelEnd(null, null, null)).toBe(0);
    });

    it('should handle only start value', () => {
        expect(calculateFuelEnd(50, null, null)).toBe(50);
    });

    it('should round to 2 decimals', () => {
        expect(calculateFuelEnd(10.115, 5.225, 3.333)).toBe(12.01);
    });
});

describe('validateFuelBalance', () => {
    it('should validate correct balance', () => {
        const result = validateFuelBalance(50, 30, 25, 55);
        expect(result.isValid).toBe(true);
    });

    it('should detect invalid balance', () => {
        const result = validateFuelBalance(50, 30, 25, 60);
        expect(result.isValid).toBe(false);
        expect(result.difference).toBe(5);
    });

    it('should allow tolerance within 0.05', () => {
        const result = validateFuelBalance(50, 30, 25, 55.04);
        expect(result.isValid).toBe(true);
    });

    it('should fail outside tolerance', () => {
        const result = validateFuelBalance(50, 30, 25, 55.1);
        expect(result.isValid).toBe(false);
    });

    it('should consider all null as valid', () => {
        const result = validateFuelBalance(null, null, null, null);
        expect(result.isValid).toBe(true);
    });
});

describe('validateOdometer', () => {
    it('should validate correct odometer (end > start)', () => {
        expect(validateOdometer(1000, 1050).isValid).toBe(true);
    });

    it('should validate equal odometer', () => {
        expect(validateOdometer(1000, 1000).isValid).toBe(true);
    });

    it('should invalidate reverse odometer', () => {
        const result = validateOdometer(1050, 1000);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
    });

    it('should skip validation for null values', () => {
        expect(validateOdometer(null, null).isValid).toBe(true);
    });
});
