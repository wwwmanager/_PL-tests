/**
 * Blank API Facade
 * 
 * Uses real backend API for all blank/batch operations.
 * Driver Mode with mockApi has been removed.
 */

import * as realApi from './api/realBlankApi';
import { WaybillBlank, WaybillBlankBatch } from '../types';
import { httpClient } from './httpClient';

// Re-export all functions from realApi
export const getBlankBatches = realApi.getBlankBatches;
export const createBlankBatch = realApi.createBlankBatch;
export const issueBlanksToDriver = realApi.issueBlanksToDriver;
export const searchBlanks = realApi.searchBlanks;
export const materializeBatch = realApi.materializeBatch;
export const spoilBlank = realApi.spoilBlank;
export const bulkSpoilBlanks = realApi.bulkSpoilBlanks;
export const countBlanksByFilter = realApi.countBlanksByFilter;
export const getDriverBlankSummary = realApi.getDriverBlankSummary;

/**
 * Get all blanks (convenience wrapper)
 */
export async function getBlanks(): Promise<WaybillBlank[]> {
    const { items } = await realApi.searchBlanks({ page: 1, pageSize: 1000 });
    return items;
}

/**
 * Get next available blank for a driver
 * @param driverId - Driver ID
 * @param organizationId - Organization ID
 * @returns First available blank or null
 */
export async function getNextBlankForDriver(
    driverId: string,
    organizationId: string
): Promise<{ blankId: string; series: string; number: number } | null> {
    try {
        const { items } = await realApi.searchBlanks({
            ownerEmployeeId: driverId,
            status: ['issued'],
            page: 1,
            pageSize: 1
        });

        if (items.length === 0) return null;

        const first = items[0];
        return { blankId: first.id, series: first.series, number: first.number };
    } catch (error) {
        console.error('[blankApi] getNextBlankForDriver error:', error);
        return null;
    }
}

/**
 * Mark a blank as used for a waybill
 * @param organizationId - Organization ID
 * @param series - Blank series
 * @param number - Blank number
 * @param waybillId - Waybill ID to link
 */
export async function useBlankForWaybill(
    organizationId: string,
    series: string,
    number: number,
    waybillId: string
): Promise<WaybillBlank> {
    const response = await httpClient.post<{ data: WaybillBlank }>('/blanks/use', {
        organizationId,
        series,
        number,
        waybillId
    });
    return response.data;
}

// Re-export types
export type { DriverBlankRange, DriverBlankSummary } from './api/realBlankApi';
