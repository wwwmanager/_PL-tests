
import { Route, Vehicle, SeasonSettings } from '../types';
import { calculateNormConsumption } from './domain/waybill';
import { isWinterDate } from './dateUtils'; // Use existing utility

export type WaybillCalculationMethod = 'by_total' | 'by_segment';

export const calculateDistance = (routes: Route[]): number => {
    return Math.round(routes.reduce((sum, r) => sum + (Number(r.distanceKm) || 0), 0));
};

export const calculateFuelConsumption = (
    routes: Route[],
    vehicle: Vehicle,
    seasonSettings: SeasonSettings,
    baseDate: string,
    dayMode: 'single' | 'multi' = 'multi'
): number => {
    const { summerRate, winterRate, cityIncreasePercent = 0, warmingIncreasePercent = 0 } = vehicle.fuelConsumptionRates;
    let totalConsumption = 0;

    for (const route of routes) {
        if (!route.distanceKm || route.distanceKm === 0) continue;

        const routeDate = dayMode === 'multi' && route.date ? route.date : baseDate;
        const isWinter = isWinterDate(routeDate, seasonSettings);

        // Определяем базовую ставку для этого отрезка (Зима/Лето)
        const baseNormRate = isWinter ? winterRate : summerRate;

        // Собираем коэффициенты
        const coefficients = {
            city: (route.isCityDriving && vehicle.useCityModifier) ? (cityIncreasePercent / 100) : 0,
            warming: (route.isWarming && vehicle.useWarmingModifier) ? (warmingIncreasePercent / 100) : 0
        };

        const segmentConsumption = calculateNormConsumption(route.distanceKm, baseNormRate, coefficients);

        totalConsumption += segmentConsumption;
    }

    return totalConsumption;
};

export const calculateStats = (
    routes: Route[],
    vehicle: Vehicle | undefined,
    seasonSettings: SeasonSettings | undefined, // Changed to undefined to match likely usage
    baseDate: string,
    dayMode: 'single' | 'multi' = 'multi',
    method: WaybillCalculationMethod = 'by_total'
) => {
    let rawDistance = routes.reduce((sum, r) => sum + (Number(r.distanceKm) || 0), 0);

    // Fallback if no vehicle/settings available
    if (!vehicle || !seasonSettings) {
        return {
            distance: Math.round(rawDistance),
            consumption: 0,
            averageRate: 0,
            baseRate: 0
        };
    }

    // Determine base rate for display only
    const isWinter = isWinterDate(baseDate, seasonSettings);
    const baseRate = isWinter ? vehicle.fuelConsumptionRates.winterRate : vehicle.fuelConsumptionRates.summerRate;

    if (method === 'by_segment') {
        const rawConsumption = calculateFuelConsumption(routes, vehicle, seasonSettings, baseDate, dayMode);

        return {
            distance: Math.round(rawDistance),
            consumption: Math.round(rawConsumption * 100) / 100,
            averageRate: rawDistance > 0 ? (rawConsumption / rawDistance) * 100 : baseRate,
            baseRate
        };
    } else {
        const roundedDistance = Math.round(rawDistance);

        const finalConsumption = calculateNormConsumption(roundedDistance, baseRate, {});

        return {
            distance: roundedDistance,
            consumption: finalConsumption,
            averageRate: baseRate,
            baseRate
        };
    }
};
