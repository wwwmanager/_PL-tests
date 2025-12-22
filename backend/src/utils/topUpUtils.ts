/**
 * FUEL-TOPUP-UTIL-040: Shared utilities for fuel card top-up scheduling
 * 
 * Common functions for computing next run times and period keys,
 * used by both fuelCardTopUpJob.ts and fuelCardService.ts
 */

import { TopUpScheduleType } from '@prisma/client';

/**
 * Compute the next scheduled run time from a base date.
 * Does NOT normalize to start of day — preserves time of day.
 * 
 * @param base - The base date (usually rule.nextRunAt or now)
 * @param scheduleType - DAILY, WEEKLY, or MONTHLY
 * @returns Next run date with same time of day
 */
export function computeNextRunAt(base: Date, scheduleType: TopUpScheduleType): Date {
    const d = new Date(base);
    switch (scheduleType) {
        case 'DAILY':
            d.setUTCDate(d.getUTCDate() + 1);
            break;
        case 'WEEKLY':
            d.setUTCDate(d.getUTCDate() + 7);
            break;
        case 'MONTHLY':
            d.setUTCMonth(d.getUTCMonth() + 1);
            break;
    }
    return d;
}

/**
 * Format date as YYYY-MM-DD in given timezone (for DAILY period key)
 */
function formatLocalDateKey(d: Date, timeZone: string): string {
    return new Intl.DateTimeFormat('sv-SE', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(d);
}

/**
 * Format date as YYYY-MM in given timezone (for MONTHLY period key)
 */
function formatMonthKey(d: Date, timeZone: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit'
    }).formatToParts(d);
    const y = parts.find(p => p.type === 'year')?.value ?? '0000';
    const m = parts.find(p => p.type === 'month')?.value ?? '00';
    return `${y}-${m}`;
}

/**
 * Compute ISO week key from local Y/M/D
 */
function isoWeekKeyFromLocalYMD(y: number, m: number, d: number): string {
    const date = new Date(Date.UTC(y, m - 1, d));
    const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0..Sun=6
    date.setUTCDate(date.getUTCDate() - dayNum + 3); // Thursday
    const isoYear = date.getUTCFullYear();
    const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
    const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
    firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
    const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
    const ww = String(week).padStart(2, '0');
    return `${isoYear}-W${ww}`;
}

/**
 * Format date as YYYY-Www ISO week key (for WEEKLY period key)
 */
function formatWeekKey(d: Date, timeZone: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(d);
    const y = Number(parts.find(p => p.type === 'year')?.value);
    const m = Number(parts.find(p => p.type === 'month')?.value);
    const dd = Number(parts.find(p => p.type === 'day')?.value);
    return isoWeekKeyFromLocalYMD(y, m, dd);
}

/**
 * Compute idempotency period key based on schedule type and timezone.
 * 
 * @param now - Current or occurred date
 * @param scheduleType - DAILY, WEEKLY, or MONTHLY
 * @param timeZone - IANA timezone (e.g., 'Europe/Moscow')
 * @returns Period key string (YYYY-MM-DD, YYYY-Www, or YYYY-MM)
 */
export function computePeriodKey(now: Date, scheduleType: TopUpScheduleType, timeZone: string): string {
    switch (scheduleType) {
        case 'DAILY':
            return formatLocalDateKey(now, timeZone);
        case 'WEEKLY':
            return formatWeekKey(now, timeZone);
        case 'MONTHLY':
            return formatMonthKey(now, timeZone);
    }
}
