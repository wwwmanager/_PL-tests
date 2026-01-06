/**
 * Единый сервис расчёта расхода топлива.
 * 
 * ВСЕ расчёты топлива в приложении ДОЛЖНЫ использовать эти функции:
 * - WaybillDetail.tsx
 * - WaybillCheckModal.tsx
 * - batchWaybillService.ts
 * 
 * Алгоритмы:
 * - BOILER: Сумма отрезков → округление до целого → расчёт расхода → округление до сотых
 * - SEGMENTS: По каждому отрезку с модификаторами (город/прогрев)
 * - MIXED: Усреднённая норма из отрезков, применённая к общему пробегу
 */

import { Route, Vehicle, SeasonSettings } from '../types';
import { isWinterDate } from './dateUtils';

// ============================================================================
// ТИПЫ
// ============================================================================

export type FuelCalculationMethod = 'BOILER' | 'SEGMENTS' | 'MIXED';

export interface FuelRates {
    summerRate: number;
    winterRate: number;
    cityIncreasePercent?: number;
    warmingIncreasePercent?: number;
    mountainIncreasePercent?: number;  // COEF-MOUNTAIN-001
}

export interface FuelCalculationInput {
    routes: Route[];
    rates: FuelRates;
    baseDate: string;
    seasonSettings: SeasonSettings | null;
    dayMode?: 'single' | 'multi';
    odometerDistance?: number;  // Для MIXED: пробег по одометру
}

export interface FuelCalculationResult {
    /** Суммарный пробег (округлённый до целого) */
    distance: number;
    /** Расход топлива (округлённый до сотых) */
    consumption: number;
    /** Расчётный одометр на конец */
    odometerEnd?: number;
}

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================================

/**
 * Определяет базовую норму расхода (зима/лето)
 */
const getBaseRate = (date: string, rates: FuelRates, seasonSettings: SeasonSettings | null): number => {
    const isWinter = isWinterDate(date, seasonSettings);
    return isWinter
        ? (rates.winterRate || rates.summerRate || 10)
        : (rates.summerRate || rates.winterRate || 10);
};

/**
 * Суммирует расстояние всех отрезков (без округления)
 */
const sumRouteDistances = (routes: Route[]): number => {
    return routes.reduce((sum, r) => sum + (Number(r.distanceKm) || 0), 0);
};

// ============================================================================
// АЛГОРИТМ 1: BOILER (По котлу)
// ============================================================================
/**
 * Расчёт по котлу — только база, без модификаторов.
 * 
 * Алгоритм:
 * 1. Суммировать все отрезки пути
 * 2. Округлить до целого
 * 3. Произвести расчёт расхода (км / 100 * норма)
 * 4. Округлить расход до сотых
 * 
 * @param input Входные данные расчёта
 * @returns Результат с distance и consumption
 */
export const calculateBoiler = (input: FuelCalculationInput): FuelCalculationResult => {
    const { routes, rates, baseDate, seasonSettings } = input;

    // 1. Суммировать все отрезки
    const rawDistance = sumRouteDistances(routes);

    // 2. Округлить до целого
    const distance = Math.round(rawDistance);

    // 3. Получить базовую норму (зима/лето)
    const baseRate = getBaseRate(baseDate, rates, seasonSettings);

    // 4. Расчёт: (км / 100) * норма
    const rawConsumption = (distance / 100) * baseRate;

    // 5. Округлить до сотых
    const consumption = Math.round(rawConsumption * 100) / 100;

    return { distance, consumption };
};

// ============================================================================
// АЛГОРИТМ 2: SEGMENTS (По отрезкам)
// ============================================================================
/**
 * Расчёт по отрезкам — с учётом модификаторов (город/прогрев) на каждом отрезке.
 * 
 * Алгоритм:
 * 1. Для каждого отрезка:
 *    - Определить базовую норму (зима/лето по дате отрезка)
 *    - Применить модификаторы (город, прогрев)
 *    - Рассчитать расход отрезка
 * 2. Просуммировать расходы всех отрезков
 * 3. Округлить итоговый расход до сотых
 * 
 * @param input Входные данные расчёта
 * @returns Результат с distance и consumption
 */
export const calculateSegments = (input: FuelCalculationInput): FuelCalculationResult => {
    const { routes, rates, baseDate, seasonSettings, dayMode = 'multi' } = input;

    let totalConsumption = 0;

    for (const route of routes) {
        const distanceKm = Number(route.distanceKm) || 0;
        if (distanceKm === 0) continue;

        // Дата отрезка (для определения сезона)
        const routeDate = (dayMode === 'multi' && route.date) ? route.date : baseDate;

        // Базовая норма для этого отрезка
        const baseRate = getBaseRate(routeDate, rates, seasonSettings);

        // Эффективная норма с модификаторами
        // Аддитивная модель коэффициентов (как на бэкенде)
        let totalCoeff = 0;

        if (route.isCityDriving && (rates.cityIncreasePercent || 0) > 0) {
            totalCoeff += (rates.cityIncreasePercent || 0) / 100;
        }

        if (route.isWarming && (rates.warmingIncreasePercent || 0) > 0) {
            totalCoeff += (rates.warmingIncreasePercent || 0) / 100;
        }

        // COEF-MOUNTAIN-001: Горная местность
        if (route.isMountainDriving && (rates.mountainIncreasePercent || 0) > 0) {
            totalCoeff += (rates.mountainIncreasePercent || 0) / 100;
        }

        const effectiveRate = baseRate * (1 + totalCoeff);

        // Расход отрезка
        totalConsumption += (distanceKm / 100) * effectiveRate;
    }

    // Общий пробег (округлённый до целого)
    const distance = Math.round(sumRouteDistances(routes));

    // Округлить расход до сотых
    const consumption = Math.round(totalConsumption * 100) / 100;

    return { distance, consumption };
};

// ============================================================================
// АЛГОРИТМ 3: MIXED (Смешанный)
// ============================================================================
/**
 * Смешанный расчёт — усреднённая норма из отрезков, применённая к общему пробегу.
 * 
 * Алгоритм:
 * 1. Рассчитать суммарный расход по отрезкам (как SEGMENTS)
 * 2. Рассчитать среднюю норму: суммарный_расход / (суммарный_пробег / 100)
 * 3. Применить среднюю норму к пробегу по одометру (или суммарному пробегу)
 * 4. Округлить расход до сотых
 * 
 * @param input Входные данные расчёта (odometerDistance используется для итогового расчёта)
 * @returns Результат с distance и consumption
 */
export const calculateMixed = (input: FuelCalculationInput): FuelCalculationResult => {
    const { routes, rates, baseDate, seasonSettings, dayMode = 'multi', odometerDistance } = input;

    // Сначала рассчитываем как SEGMENTS
    let totalConsRaw = 0;
    let segmentsKm = 0;

    for (const route of routes) {
        const distanceKm = Number(route.distanceKm) || 0;
        if (distanceKm === 0) continue;

        const routeDate = (dayMode === 'multi' && route.date) ? route.date : baseDate;
        const baseRate = getBaseRate(routeDate, rates, seasonSettings);

        // Аддитивная модель коэффициентов
        let totalCoeff = 0;

        if (route.isCityDriving && (rates.cityIncreasePercent || 0) > 0) {
            totalCoeff += (rates.cityIncreasePercent || 0) / 100;
        }

        if (route.isWarming && (rates.warmingIncreasePercent || 0) > 0) {
            totalCoeff += (rates.warmingIncreasePercent || 0) / 100;
        }

        // COEF-MOUNTAIN-001: Горная местность
        if (route.isMountainDriving && (rates.mountainIncreasePercent || 0) > 0) {
            totalCoeff += (rates.mountainIncreasePercent || 0) / 100;
        }

        const effectiveRate = baseRate * (1 + totalCoeff);

        totalConsRaw += (distanceKm / 100) * effectiveRate;
        segmentsKm += distanceKm;
    }

    // Расстояние из маршрутов (округлённое)
    const distance = Math.round(segmentsKm);

    // Если нет маршрутов, fallback к BOILER
    if (segmentsKm === 0) {
        return calculateBoiler(input);
    }

    // Средняя норма
    const avgRate = totalConsRaw / (segmentsKm / 100);

    // Применяем к одометру (если есть) или к пробегу из маршрутов
    const finalDistance = odometerDistance ?? distance;
    const rawConsumption = (finalDistance / 100) * avgRate;

    // Округлить расход до сотых
    const consumption = Math.round(rawConsumption * 100) / 100;

    return { distance, consumption };
};

// ============================================================================
// УНИВЕРСАЛЬНАЯ ТОЧКА ВХОДА
// ============================================================================
/**
 * Универсальная функция расчёта топлива.
 * Выбирает алгоритм на основе указанного метода.
 * 
 * @param method Метод расчёта: 'BOILER' | 'SEGMENTS' | 'MIXED'
 * @param input Входные данные
 * @returns Результат расчёта
 */
export const calculateFuel = (
    method: FuelCalculationMethod,
    input: FuelCalculationInput
): FuelCalculationResult => {
    switch (method) {
        case 'BOILER':
            return calculateBoiler(input);
        case 'SEGMENTS':
            return calculateSegments(input);
        case 'MIXED':
            return calculateMixed(input);
        default:
            // Fallback к BOILER
            return calculateBoiler(input);
    }
};

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ СОВМЕСТИМОСТИ
// ============================================================================

/**
 * Совместимость с методами из batchWaybillService:
 * 'by_total' → 'BOILER'
 * 'by_segment' → 'SEGMENTS'
 */
export const mapLegacyMethod = (legacyMethod: string): FuelCalculationMethod => {
    if (legacyMethod === 'by_segment') return 'SEGMENTS';
    if (legacyMethod === 'by_total') return 'BOILER';
    return legacyMethod as FuelCalculationMethod;
};

/**
 * Рассчитывает одометр на конец.
 * Формула: Math.round(odometerStart + rawDistance)
 * Соответствует batchWaybillService: odometerEnd = Math.round(startOdo + distance)
 */
export const calculateOdometerEnd = (odometerStart: number, routes: Route[]): number => {
    const rawDistance = sumRouteDistances(routes);
    return Math.round(odometerStart + rawDistance);
};

/**
 * Рассчитывает остаток топлива на конец.
 * Формула: Math.round((start + filled - consumed) * 100) / 100
 */
export const calculateFuelEnd = (
    fuelStart: number,
    fuelFilled: number,
    fuelConsumed: number
): number => {
    const result = (fuelStart || 0) + (fuelFilled || 0) - (fuelConsumed || 0);
    return Math.round(result * 100) / 100;
};

// ============================================================================
// НОВАЯ УНИФИЦИРОВАННАЯ ФУНКЦИЯ (по запросу WB-1002)
// ============================================================================

import { FuelConsumptionRates } from '../types';

export interface FuelCalculationParams {
    method: FuelCalculationMethod;
    routes: Route[];
    vehicleRates?: FuelConsumptionRates;
    seasonSettings?: SeasonSettings | null;
    odometerDistanceKm?: number;
    baseDate?: string; // Date to determine winter/summer if route date is missing
    dayMode?: 'single' | 'multi';
}

/**
 * Calculates planned fuel based on the selected method.
 * Unifies logic between Frontend and Backend.
 */
export function calculatePlannedFuelByMethod(params: FuelCalculationParams): {
    plannedFuel: number;
    totalDistance: number;
    baseRateUsed: number; // For informational purposes (e.g. displaying "Norm")
} {
    const {
        method,
        routes,
        vehicleRates,
        seasonSettings,
        odometerDistanceKm,
        baseDate = new Date().toISOString(),
        dayMode = 'multi',
    } = params;

    // Defaults if rates are missing
    const rates = vehicleRates || { winterRate: 0, summerRate: 0 };

    // Calculate total distance first
    const routesTotalDistance = routes.reduce((sum, r) => sum + (Number(r.distanceKm) || 0), 0);
    const totalDistance = Math.round(routesTotalDistance);

    // Helper to determine rate for a specific date
    const getBaseRateForDate = (dateStr: string) => {
        if (!seasonSettings) return rates.summerRate || 0;
        return isWinterDate(dateStr, seasonSettings) ? (rates.winterRate || 0) : (rates.summerRate || 0);
    };

    // Base rate for the main date (used for BOILER/MIXED average calc)
    const mainBaseRate = getBaseRateForDate(baseDate);

    if (method === 'BOILER') {
        // BOILER Logic:
        // 1. If segments exist, Sum(segments) -> Round -> Distance.
        // 2. Else use odometerDistanceKm.
        // 3. Formula: (Distance / 100) * BaseRate.
        // Coefficients (City/Warming) are IGNORED.

        let calcDistance = odometerDistanceKm || 0;

        if (routes && routes.length > 0) {
            calcDistance = totalDistance; // Already rounded above
        } else {
            // Ideally odometerDistanceKm should be used if passed and valid
            if (odometerDistanceKm == null) calcDistance = 0;
        }

        if (calcDistance <= 0) return { plannedFuel: 0, totalDistance: calcDistance, baseRateUsed: mainBaseRate };

        const planned = (calcDistance / 100) * mainBaseRate;
        return {
            plannedFuel: Math.round(planned * 100) / 100,
            totalDistance: calcDistance,
            baseRateUsed: mainBaseRate
        };
    }

    if (method === 'SEGMENTS') {
        // SEGMENTS Logic:
        // Sum of exact consumption for each segment.
        // Each segment: (Dist / 100) * BaseRate * (1 + City + Warming)

        let totalPlanned = 0;

        for (const route of routes) {
            const dist = Number(route.distanceKm) || 0;
            if (dist <= 0) continue;

            const routeDate = (dayMode === 'multi' && route.date) ? route.date : baseDate;
            const baseRate = getBaseRateForDate(routeDate);

            let coeffTotal = 0;
            if (route.isCityDriving && (rates.cityIncreasePercent || 0) > 0) {
                coeffTotal += (rates.cityIncreasePercent || 0) / 100;
            }
            if (route.isWarming && (rates.warmingIncreasePercent || 0) > 0) {
                coeffTotal += (rates.warmingIncreasePercent || 0) / 100;
            }
            // COEF-MOUNTAIN-001: Горная местность
            if (route.isMountainDriving && (rates.mountainIncreasePercent || 0) > 0) {
                coeffTotal += (rates.mountainIncreasePercent || 0) / 100;
            }

            const segmentConsumption = (dist / 100) * baseRate * (1 + coeffTotal);
            totalPlanned += segmentConsumption;
        }

        return {
            plannedFuel: Math.round(totalPlanned * 100) / 100,
            totalDistance: totalDistance, // Note: Segments method usually implies total distance is sum of segments
            baseRateUsed: mainBaseRate // This is tricky for segments as it varies, but we return main one for UI reference
        };
    }

    if (method === 'MIXED') {
        // MIXED Logic:
        // 1. Calculate ideal consumption for segments (exact).
        // 2. Calculate average rate: IdealCons / (SumSegments / 100).
        // 3. Apply average rate to Odometer Distance.

        let totalConsRaw = 0;
        let segmentsKm = 0;

        for (const route of routes) {
            const dist = Number(route.distanceKm) || 0;
            if (dist <= 0) continue;

            const routeDate = (dayMode === 'multi' && route.date) ? route.date : baseDate;
            const baseRate = getBaseRateForDate(routeDate);

            let coeffTotal = 0;
            if (route.isCityDriving && (rates.cityIncreasePercent || 0) > 0) {
                coeffTotal += (rates.cityIncreasePercent || 0) / 100;
            }
            if (route.isWarming && (rates.warmingIncreasePercent || 0) > 0) {
                coeffTotal += (rates.warmingIncreasePercent || 0) / 100;
            }
            // COEF-MOUNTAIN-001: Горная местность
            if (route.isMountainDriving && (rates.mountainIncreasePercent || 0) > 0) {
                coeffTotal += (rates.mountainIncreasePercent || 0) / 100;
            }

            totalConsRaw += (dist / 100) * baseRate * (1 + coeffTotal);
            segmentsKm += dist;
        }

        if (segmentsKm <= 0) return { plannedFuel: 0, totalDistance: odometerDistanceKm || 0, baseRateUsed: mainBaseRate };

        const avgRate = totalConsRaw / (segmentsKm / 100);
        const finalDistance = odometerDistanceKm || 0;
        const totalPlanned = (finalDistance / 100) * avgRate;

        return {
            plannedFuel: Math.round(totalPlanned * 100) / 100,
            totalDistance: finalDistance,
            baseRateUsed: avgRate // Here the effective rate is the average rate
        };
    }

    return { plannedFuel: 0, totalDistance: 0, baseRateUsed: 0 };
}
