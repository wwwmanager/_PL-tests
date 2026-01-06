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
 * Supported fuel calculation methods
 */
export type FuelCalculationMethod = 'BOILER' | 'MIXED' | 'SEGMENTS';

export interface FuelSegment {
    distanceKm: number;
    isCityDriving?: boolean;
    isWarming?: boolean;
    isMountainDriving?: boolean; // COEF-MOUNTAIN-001
}

export interface FuelConsumptionRates {
    winterRate?: number;
    summerRate?: number;
    cityIncreasePercent?: number;
    warmingIncreasePercent?: number;
    mountainIncreasePercent?: number; // COEF-MOUNTAIN-001
}

export interface FuelCoefficients {
    winter?: number;
    city?: number;
    warming?: number;
    mountain?: number; // COEF-MOUNTAIN-001
    other?: number;
}

export interface DrivingFlags {
    isCityDriving?: boolean;
    isWarming?: boolean;
    isMountainDriving?: boolean; // COEF-MOUNTAIN-001
}

// ... unchanged ...

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

export function calculateNormConsumption(
    distanceKm: number,
    baseNormRate: number,
    coefficients: FuelCoefficients
): number {
    if (distanceKm <= 0 || baseNormRate <= 0) {
        return 0;
    }

    const totalCoeff =
        (coefficients.winter || 0) +
        (coefficients.city || 0) +
        (coefficients.warming || 0) +
        (coefficients.mountain || 0) + // COEF-MOUNTAIN-001
        (coefficients.other || 0);

    const totalConsumption = (distanceKm / 100) * baseNormRate * (1 + totalCoeff);
    return Math.round(totalConsumption * 100) / 100;
}

export function calculatePlannedFuel(
    distanceKm: number,
    rates: FuelConsumptionRates | null | undefined,
    flags: DrivingFlags,
    isWinter: boolean
): number {
    if (!rates) {
        return 0;
    }

    const baseRate = isWinter
        ? (rates.winterRate ?? rates.summerRate ?? 0)
        : (rates.summerRate ?? rates.winterRate ?? 0);

    if (baseRate <= 0) {
        return 0;
    }

    const coefficients: FuelCoefficients = {};

    if (flags.isCityDriving && rates.cityIncreasePercent) {
        coefficients.city = rates.cityIncreasePercent / 100;
    }

    if (flags.isWarming && rates.warmingIncreasePercent) {
        coefficients.warming = rates.warmingIncreasePercent / 100;
    }

    // COEF-MOUNTAIN-001
    if (flags.isMountainDriving && rates.mountainIncreasePercent) {
        coefficients.mountain = rates.mountainIncreasePercent / 100;
    }

    return calculateNormConsumption(distanceKm, baseRate, coefficients);
}

export function calculatePlannedFuelByMethod(params: {
    method: FuelCalculationMethod;
    baseRate: number;
    odometerDistanceKm?: number | null;
    segments?: FuelSegment[];
    rates: FuelConsumptionRates;
}): number {
    const { method, baseRate, odometerDistanceKm, segments, rates } = params;

    if (baseRate <= 0) return 0;

    switch (method) {
        case 'BOILER': {
            if (odometerDistanceKm == null || odometerDistanceKm <= 0) return 0;
            return calculateNormConsumption(odometerDistanceKm, baseRate, {});
        }

        case 'SEGMENTS': {
            if (!segments || segments.length === 0) return 0;
            let total = 0;
            for (const seg of segments) {
                if (seg.distanceKm <= 0) continue;
                const coeff = getCoefficientsForSegment(seg, rates);
                const segPlanned = calculateNormConsumption(seg.distanceKm, baseRate, coeff);
                total += segPlanned;
            }
            return Math.round(total * 100) / 100;
        }

        case 'MIXED': {
            if (odometerDistanceKm == null || odometerDistanceKm <= 0) return 0;
            if (!segments || segments.length === 0) return 0;

            let totalConsExact = 0;
            let totalSegmentsKm = 0;

            for (const seg of segments) {
                if (seg.distanceKm <= 0) continue;
                const coeff = getCoefficientsForSegment(seg, rates);

                const totalCoeff =
                    (coeff.winter || 0) +
                    (coeff.city || 0) +
                    (coeff.warming || 0) +
                    (coeff.mountain || 0); // COEF-MOUNTAIN-001

                const segConsRaw = (seg.distanceKm / 100) * baseRate * (1 + totalCoeff);

                totalConsExact += segConsRaw;
                totalSegmentsKm += seg.distanceKm;
            }

            if (totalSegmentsKm <= 0) return 0;

            const avgRate = totalConsExact / (totalSegmentsKm / 100);
            const finalPlanned = (odometerDistanceKm / 100) * avgRate;
            return Math.round(finalPlanned * 100) / 100;
        }

        default:
            return 0;
    }
}

function getCoefficientsForSegment(seg: FuelSegment, rates: FuelConsumptionRates): FuelCoefficients {
    const coeff: FuelCoefficients = {};
    if (seg.isCityDriving && rates.cityIncreasePercent) {
        coeff.city = rates.cityIncreasePercent / 100;
    }
    if (seg.isWarming && rates.warmingIncreasePercent) {
        coeff.warming = rates.warmingIncreasePercent / 100;
    }
    // COEF-MOUNTAIN-001
    if (seg.isMountainDriving && rates.mountainIncreasePercent) {
        coeff.mountain = rates.mountainIncreasePercent / 100;
    }
    return coeff;
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
