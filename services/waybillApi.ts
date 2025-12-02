/**
 * Waybill API Facade
 * 
 * Provides unified API for waybills that can switch between mockApi and real backend
 * based on appMode setting in AppSettings
 */

import * as mockApi from './mockApi';
import * as realApi from './api/realWaybillApi';
import { getAppSettings } from './mockApi';
import type { Waybill } from '../types';
import type { FrontWaybillStatus } from './api/waybillStatusMap';

/**
 * Determines if we should use real backend API or mockApi
 * - Central mode: Uses real backend (USE_REAL_API = true)
 * - Driver mode: Uses mockApi + IndexedDB (USE_REAL_API = false)
 */
async function shouldUseRealApi(): Promise<boolean> {
    try {
        const settings = await getAppSettings();
        const useReal = settings.appMode === 'central';

        if (import.meta.env.DEV) {
            console.log(`🔗 Waybill API: appMode = "${settings.appMode}" → ${useReal ? 'REAL BACKEND' : 'MOCK API'}`);
        }

        return useReal;
    } catch (error) {
        // Fallback: if can't get settings, use mockApi in DEV, real API in PROD
        const fallback = !import.meta.env.DEV;
        if (import.meta.env.DEV) {
            console.warn('⚠️ Could not load AppSettings, fallback to:', fallback ? 'REAL API' : 'MOCK API');
        }
        return fallback;
    }
}

/**
 * Get all waybills with optional pagination
 */
export async function getWaybills(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
}) {
    const useReal = await shouldUseRealApi();
    return useReal ? realApi.getWaybills(params) : mockApi.getWaybills();
}

/**
 * Get waybill by ID
 */
export async function getWaybillById(id: string): Promise<Waybill> {
    const useReal = await shouldUseRealApi();
    if (useReal) {
        return realApi.getWaybillById(id);
    } else {
        const waybills = await mockApi.getWaybills();
        const found = waybills.find(w => w.id === id);
        if (!found) throw new Error(`Waybill ${id} not found`);
        return found;
    }
}

/**
 * Create new waybill
 */
export async function addWaybill(data: any) {
    const useReal = await shouldUseRealApi();
    return useReal ? realApi.addWaybill(data) : mockApi.addWaybill(data);
}

/**
 * Update waybill
 */
export async function updateWaybill(waybill: Waybill) {
    const useReal = await shouldUseRealApi();
    return useReal ? realApi.updateWaybill(waybill) : mockApi.updateWaybill(waybill);
}

/**
 * Delete waybill
 */
export async function deleteWaybill(id: string, markAsSpoiled?: boolean) {
    const useReal = await shouldUseRealApi();
    return useReal ? realApi.deleteWaybill(id) : mockApi.deleteWaybill(id, markAsSpoiled);
}

/**
 * Update waybill status
 * Accepts both WaybillStatus enum and FrontWayb illStatus string literals
 */
export async function updateWaybillStatus(id: string, status: FrontWaybillStatus | any) {
    const useReal = await shouldUseRealApi();
    return useReal ? realApi.updateWaybillStatus(id, status as FrontWaybillStatus) : mockApi.updateWaybillStatus(id, status);
}

/**
 * Change waybill status with context
 * Accepts both WaybillStatus enum and FrontWaybillStatus string literals
 */
export async function changeWaybillStatus(
    id: string,
    status: FrontWaybillStatus | any,
    ctx?: { userId?: string; appMode?: string; reason?: string }
) {
    const useReal = await shouldUseRealApi();
    return useReal ? realApi.changeWaybillStatus(id, status as FrontWaybillStatus, ctx) : mockApi.changeWaybillStatus(id, status, ctx);
}

/**
 * Get latest waybill (most recent by date)
 */
export async function getLatestWaybill(): Promise<Waybill | null> {
    const useReal = await shouldUseRealApi();
    if (useReal) {
        // For real API: get all waybills and find the latest
        const response = await realApi.getWaybills();
        const waybills = response.waybills;
        if (waybills.length === 0) return null;

        // Sort by date descending and return first
        const sorted = [...waybills].sort((a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        return sorted[0];
    } else {
        return mockApi.getLatestWaybill();
    }
}

// Re-export other mockApi functions that are not yet implemented in realApi
export const fetchWaybills = mockApi.fetchWaybills;

