/**
 * @deprecated Функции расчёта топлива перенесены в fuelCalculationService.ts
 * Этот файл оставлен только для типов и calculateDistance
 * 
 * Используйте:
 * - calculatePlannedFuelByMethod из services/fuelCalculationService.ts
 */

import { Route } from '../types';

export type WaybillCalculationMethod = 'by_total' | 'by_segment';

/**
 * Рассчитывает суммарное расстояние по маршрутам (округлённое до целых км)
 */
export const calculateDistance = (routes: Route[]): number => {
    return Math.round(routes.reduce((sum, r) => sum + (Number(r.distanceKm) || 0), 0));
};
