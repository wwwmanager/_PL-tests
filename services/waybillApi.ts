/**
 * Waybill API Facade
 * 
 * Provides unified API for waybills that can switch between mockApi and real backend
 * based on VITE_USE_REAL_API environment variable
 */

import * as mockApi from './mockApi';
import * as realApi from './api/realWaybillApi';

// Feature flag to switch between mockApi and real backend
const USE_REAL_API = import.meta.env.VITE_USE_REAL_API === 'true';

// Log which API is being used (only in development)
if (import.meta.env.DEV) {
    console.log(`🔗 Waybill API: Using ${USE_REAL_API ? 'REAL BACKEND' : 'MOCK API'}`);
}

/**
 * Get all waybills
 */
export const getWaybills = USE_REAL_API
    ? realApi.getWaybills
    : mockApi.getWaybills;

/**
 * Get waybill by ID
 */
export const getWaybillById = USE_REAL_API
    ? realApi.getWaybillById
    : async (id: string) => {
        const waybills = await mockApi.getWaybills();
        const found = waybills.find(w => w.id === id);
        if (!found) throw new Error(`Waybill ${id} not found`);
        return found;
    };

/**
 * Create new waybill
 */
export const addWaybill = USE_REAL_API
    ? realApi.addWaybill
    : mockApi.addWaybill;

/**
 * Update waybill
 */
export const updateWaybill = USE_REAL_API
    ? realApi.updateWaybill
    : mockApi.updateWaybill;

/**
 * Delete waybill
 */
export const deleteWaybill = USE_REAL_API
    ? realApi.deleteWaybill
    : mockApi.deleteWaybill;

/**
 * Update waybill status
 */
export const updateWaybillStatus = USE_REAL_API
    ? realApi.updateWaybillStatus
    : mockApi.updateWaybillStatus;

/**
 * Change waybill status with context
 */
export const changeWaybillStatus = USE_REAL_API
    ? realApi.changeWaybillStatus
    : mockApi.changeWaybillStatus;

// Re-export other mockApi functions that are not yet implemented in realApi
export const fetchWaybills = mockApi.fetchWaybills;
export const getLatestWaybill = mockApi.getLatestWaybill;
