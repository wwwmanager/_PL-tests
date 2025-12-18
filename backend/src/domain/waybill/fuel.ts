/**
 * Backend Domain: Waybill Fuel Calculations
 * Ported from frontend services/domain/waybill.ts
 * 
 * Provides pure functions for:
 * - Calculating planned fuel consumption (normative)
 * - Calculating fuel balance
 * - Validating fuel data integrity
 */

import Decimal from 'decimal.js';

/**
 * Fuel consumption rates from Vehicle
 */
export interface FuelConsumptionRates {
    winterRate?: number;
    summerRate?: number;
    cityIncreasePercent?: number;
    warmingIncreasePercent?: number;
}

/**
 * Coefficients for fuel calculation
 * Values should be in decimal form (0.1 = 10%, 0.05 = 5%)
 */
export interface FuelCoefficients {
    /** Winter coefficient (e.g., 0.1 for 10% increase) */
    winter?: number;
    /** City driving coefficient */
    city?: number;
    /** Engine warming coefficient */
    warming?: number;
    /** Other coefficients */
    other?: number;
}

/**
 * Flags indicating driving conditions
 */
export interface DrivingFlags {
    isCityDriving?: boolean;
    isWarming?: boolean;
}

/**
 * Calculate distance in kilometers from odometer readings
 * 
 * @param odometerStart - Start odometer reading
 * @param odometerEnd - End odometer reading
 * @returns Distance in km or null if invalid
 */
export function calculateDistanceKm(
    odometerStart: number | Decimal | null | undefined,
    odometerEnd: number | Decimal | null | undefined
): number | null {
    if (odometerStart == null || odometerEnd == null) {
        return null;
    }

    const start = typeof odometerStart === 'number' ? odometerStart : odometerStart.toNumber();
    const end = typeof odometerEnd === 'number' ? odometerEnd : odometerEnd.toNumber();

    if (isNaN(start) || isNaN(end)) {
        return null;
    }

    const distance = end - start;
    return distance >= 0 ? distance : null;
}

/**
 * Рассчитывает нормативный расход топлива на заданное расстояние.
 * 
 * Formula: (distanceKm / 100) * baseNormRate * (1 + totalCoefficients)
 * 
 * @param distanceKm - Distance in kilometers
 * @param baseNormRate - Base consumption rate (liters per 100km)
 * @param coefficients - Additional coefficients (winter, city, warming, etc.)
 * @returns Planned fuel consumption in liters (rounded to 2 decimal places)
 * 
 * @example
 * calculateNormConsumption(100, 10, {}) // 10
 * calculateNormConsumption(100, 10, { winter: 0.1 }) // 11 (10% winter increase)
 * calculateNormConsumption(100, 20, { winter: 0.1, city: 0.05 }) // 23 (15% total increase)
 */
export function calculateNormConsumption(
    distanceKm: number,
    baseNormRate: number,
    coefficients: FuelCoefficients
): number {
    if (distanceKm <= 0 || baseNormRate <= 0) {
        return 0;
    }

    // Sum all coefficients
    const totalCoeff =
        (coefficients.winter || 0) +
        (coefficients.city || 0) +
        (coefficients.warming || 0) +
        (coefficients.other || 0);

    // Calculate consumption: (km / 100) * baseRate * (1 + coeff)
    const totalConsumption = (distanceKm / 100) * baseNormRate * (1 + totalCoeff);

    // Round to 2 decimal places (standard for fuel accounting)
    return Math.round(totalConsumption * 100) / 100;
}

/**
 * Calculate planned fuel consumption based on vehicle rates and driving conditions
 * 
 * @param distanceKm - Distance in kilometers
 * @param rates - Vehicle fuel consumption rates
 * @param flags - Driving condition flags
 * @param isWinter - Whether the date is in winter period
 * @returns Planned fuel consumption in liters
 */
export function calculatePlannedFuel(
    distanceKm: number,
    rates: FuelConsumptionRates | null | undefined,
    flags: DrivingFlags,
    isWinter: boolean
): number {
    if (!rates) {
        return 0;
    }

    // Select base rate based on season
    const baseRate = isWinter
        ? (rates.winterRate ?? rates.summerRate ?? 0)
        : (rates.summerRate ?? rates.winterRate ?? 0);

    if (baseRate <= 0) {
        return 0;
    }

    // Build coefficients from flags and rates
    const coefficients: FuelCoefficients = {};

    // City driving coefficient
    if (flags.isCityDriving && rates.cityIncreasePercent) {
        coefficients.city = rates.cityIncreasePercent / 100;
    }

    // Warming coefficient
    if (flags.isWarming && rates.warmingIncreasePercent) {
        coefficients.warming = rates.warmingIncreasePercent / 100;
    }

    return calculateNormConsumption(distanceKm, baseRate, coefficients);
}

/**
 * Calculate fuel at end of trip
 * Formula: start + received - consumed
 * 
 * @param fuelStart - Fuel at start of trip
 * @param fuelReceived - Fuel received during trip
 * @param fuelConsumed - Fuel consumed during trip
 * @returns Fuel at end of trip (rounded to 2 decimals)
 */
export function calculateFuelEnd(
    fuelStart: number | null | undefined,
    fuelReceived: number | null | undefined,
    fuelConsumed: number | null | undefined
): number {
    const start = fuelStart ?? 0;
    const received = fuelReceived ?? 0;
    const consumed = fuelConsumed ?? 0;

    const end = start + received - consumed;
    return Math.round(end * 100) / 100;
}

/**
 * Result of fuel balance validation
 */
export interface FuelBalanceValidationResult {
    isValid: boolean;
    expectedEnd: number;
    actualEnd: number;
    difference: number;
    error?: string;
}

/**
 * Validate fuel balance integrity
 * Checks that: fuelStart + fuelReceived - fuelConsumed ≈ fuelEnd (within tolerance)
 * 
 * @param fuelStart - Fuel at start
 * @param fuelReceived - Fuel received
 * @param fuelConsumed - Fuel consumed
 * @param fuelEnd - Fuel at end
 * @param tolerance - Allowed difference (default 0.05 liters)
 * @returns Validation result
 */
export function validateFuelBalance(
    fuelStart: number | null | undefined,
    fuelReceived: number | null | undefined,
    fuelConsumed: number | null | undefined,
    fuelEnd: number | null | undefined,
    tolerance: number = 0.05
): FuelBalanceValidationResult {
    // If all values are null/undefined, skip validation
    if (fuelStart == null && fuelReceived == null && fuelConsumed == null && fuelEnd == null) {
        return {
            isValid: true,
            expectedEnd: 0,
            actualEnd: 0,
            difference: 0
        };
    }

    const start = fuelStart ?? 0;
    const received = fuelReceived ?? 0;
    const consumed = fuelConsumed ?? 0;
    const actual = fuelEnd ?? 0;

    const expected = calculateFuelEnd(start, received, consumed);
    const difference = Math.abs(expected - actual);

    if (difference > tolerance) {
        return {
            isValid: false,
            expectedEnd: expected,
            actualEnd: actual,
            difference,
            error: `Топливный баланс не сходится: ожидалось ${expected.toFixed(2)}, получено ${actual.toFixed(2)} (разница ${difference.toFixed(2)})`
        };
    }

    return {
        isValid: true,
        expectedEnd: expected,
        actualEnd: actual,
        difference
    };
}

/**
 * Validate that odometer end >= odometer start
 */
export function validateOdometer(
    odometerStart: number | Decimal | null | undefined,
    odometerEnd: number | Decimal | null | undefined
): { isValid: boolean; error?: string } {
    if (odometerStart == null || odometerEnd == null) {
        return { isValid: true };
    }

    const start = typeof odometerStart === 'number' ? odometerStart : odometerStart.toNumber();
    const end = typeof odometerEnd === 'number' ? odometerEnd : odometerEnd.toNumber();

    if (end < start) {
        return {
            isValid: false,
            error: `Конечный пробег (${end}) не может быть меньше начального (${start})`
        };
    }

    return { isValid: true };
}
