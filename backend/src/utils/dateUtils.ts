/**
 * Date utilities for backend
 * Ported from frontend services/dateUtils.ts
 */

import { SeasonSettings } from '../services/settingsService';

/**
 * Determines if a given date falls within the winter period based on season settings.
 * 
 * @param dateISO - Date string in ISO format (YYYY-MM-DD) or Date object
 * @param settings - Season settings from settingsService
 * @returns true if the date is in winter period, false otherwise
 * 
 * @example
 * // Recurring settings: winter Nov 1 - summer Apr 1
 * isWinterDate('2024-01-15', { type: 'recurring', winterDay: 1, winterMonth: 11, summerDay: 1, summerMonth: 4 }) // true
 * isWinterDate('2024-07-15', { type: 'recurring', winterDay: 1, winterMonth: 11, summerDay: 1, summerMonth: 4 }) // false
 * 
 * // Manual settings
 * isWinterDate('2024-12-01', { type: 'manual', winterStartDate: '2024-11-01', winterEndDate: '2025-03-31' }) // true
 */
export function isWinterDate(dateISO: string | Date, settings: SeasonSettings): boolean {
    // Handle invalid inputs
    if (!dateISO || !settings) {
        return false;
    }

    const d = typeof dateISO === 'string' ? new Date(dateISO) : dateISO;

    // Guard against invalid dates
    if (isNaN(d.getTime())) {
        return false;
    }

    if (settings.type === 'manual') {
        const start = new Date(settings.winterStartDate);
        const end = new Date(settings.winterEndDate);

        // Guard against invalid date ranges
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return false;
        }

        // Manual mode: check if within winter start/end range
        // Handle cases where winter spans across New Year
        if (start <= end) {
            // Normal case: winterStart <= winterEnd (e.g., Nov 1 - Mar 31 same year)
            return d >= start && d <= end;
        } else {
            // Spanning New Year: winterStart > winterEnd (e.g., Nov 1 2024 - Mar 31 2025)
            // This shouldn't happen with manual mode as dates are absolute
            return d >= start || d <= end;
        }
    }

    // Recurring mode
    const year = d.getFullYear();
    const summerStart = new Date(year, settings.summerMonth - 1, settings.summerDay);
    const winterStart = new Date(year, settings.winterMonth - 1, settings.winterDay);

    if (summerStart < winterStart) {
        // Summer starts before winter in the same year (e.g., April -> November)
        // Winter is: before summer start OR after/on winter start
        return d < summerStart || d >= winterStart;
    } else {
        // Winter is continuous across year boundary (e.g., November -> April)
        // This case: summerMonth > winterMonth (e.g., winter=Nov, summer=Apr)
        // Winter is: on/after winter start AND before summer start
        return d >= winterStart && d < summerStart;
    }
}

/**
 * Parse a date string safely
 * @param dateStr - Date string to parse
 * @returns Date object or null if invalid
 */
export function parseDate(dateStr: string | null | undefined): Date | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
}

/**
 * Format date to ISO string (YYYY-MM-DD)
 */
export function formatDateISO(date: Date): string {
    return date.toISOString().split('T')[0];
}
