/**
 * Date utilities for season/winter detection
 * Extracted from mockApi.ts for use across the application.
 */

import { SeasonSettings } from '../types';

/**
 * Determines if a given date falls within the winter period based on season settings.
 * 
 * @param date - Date string in ISO format (YYYY-MM-DD)
 * @param settings - Season settings from backend or localStorage
 * @returns true if the date is in winter period, false otherwise
 */
export const isWinterDate = (date: string, settings: SeasonSettings): boolean => {
    const d = new Date(date);

    if (settings.type === 'manual') {
        return d >= new Date(settings.winterStartDate) && d <= new Date(settings.winterEndDate);
    }

    // Recurring pattern (yearly)
    const summerStart = new Date(d.getFullYear(), settings.summerMonth - 1, settings.summerDay);
    const winterStart = new Date(d.getFullYear(), settings.winterMonth - 1, settings.winterDay);

    if (summerStart < winterStart) {
        // Summer starts before winter in the same year (e.g., April -> November)
        return d < summerStart || d >= winterStart;
    } else {
        // Winter is continuous across year boundary (e.g., November -> April)
        return d >= winterStart && d < summerStart;
    }
};
