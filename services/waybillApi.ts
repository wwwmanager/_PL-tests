/**
 * Waybill API Facade
 * 
 * Uses real backend API for all waybill operations.
 * Driver Mode with mockApi has been removed.
 */

import * as realApi from './api/realWaybillApi';
import type { Waybill } from '../types';
import type { FrontWaybillStatus } from './api/waybillStatusMap';

// Re-export main functions from realApi
export const getWaybillById = realApi.getWaybillById;
export const addWaybill = realApi.addWaybill;
export const updateWaybill = realApi.updateWaybill;
export const deleteWaybill = realApi.deleteWaybill;
export const updateWaybillStatus = realApi.updateWaybillStatus;
export const changeWaybillStatus = realApi.changeWaybillStatus;

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
    return realApi.getWaybills(params);
}

/**
 * Get latest waybill (most recent by date)
 */
export async function getLatestWaybill(): Promise<Waybill | null> {
    const response = await realApi.getWaybills();
    const waybills = response.waybills;
    if (waybills.length === 0) return null;

    // Sort by date descending and return first
    const sorted = [...waybills].sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return sorted[0];
}

/**
 * Get last waybill for a specific vehicle
 */
export async function getLastWaybillForVehicle(vehicleId: string): Promise<Waybill | null> {
    const response = await realApi.getWaybills();
    const waybills = response.waybills;

    const vehicleWaybills = waybills
        .filter(w => w.vehicleId === vehicleId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return vehicleWaybills[0] || null;
}

/**
 * Fetch waybills (legacy compatibility)
 * @deprecated Use getWaybills instead
 */
export async function fetchWaybills(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
}) {
    const result = await realApi.getWaybills(params);
    return result.waybills;
}

