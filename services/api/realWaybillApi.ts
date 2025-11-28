/**
 * Real Waybill API Adapter
 * 
 * Implements the same signatures as mockApi but uses real backend API
 * This allows seamless switching between mockApi and real backend
 */

import { http } from '../httpClient';
import {
    mapBackendWaybillToFront,
    mapFrontWaybillToBackendCreate,
    mapFrontWaybillToBackendUpdate,
} from './waybillMapper';
import { toBackendStatus } from './waybillStatusMap';
import type { BackendWaybillDto, FrontWaybill } from './waybillApiTypes';
import type { FrontWaybillStatus } from './waybillStatusMap';

/**
 * Get list of all waybills
 * Signature matches: mockApi.getWaybills()
 */
export async function getWaybills(): Promise<FrontWaybill[]> {
    const data = await http.get<BackendWaybillDto[]>('/waybills');
    return data.map(mapBackendWaybillToFront);
}

/**
 * Get waybill by ID
 */
export async function getWaybillById(id: string): Promise<FrontWaybill> {
    const data = await http.get<BackendWaybillDto>(`/waybills/${id}`);
    return mapBackendWaybillToFront(data);
}

/**
 * Create new waybill
 * Signature matches: mockApi.addWaybill(waybill: Omit<Waybill, 'id'>)
 */
export async function addWaybill(
    waybill: Omit<FrontWaybill, 'id'>
): Promise<FrontWaybill> {
    const payload = mapFrontWaybillToBackendCreate(waybill);

    const created = await http.post<BackendWaybillDto>('/waybills', payload);
    return mapBackendWaybillToFront(created);
}

/**
 * Update waybill
 * Signature matches: mockApi.updateWaybill(w: Waybill)
 */
export async function updateWaybill(w: FrontWaybill): Promise<FrontWaybill> {
    const payload = mapFrontWaybillToBackendUpdate(w);

    const updated = await http.put<BackendWaybillDto>(`/waybills/${w.id}`, payload);
    return mapBackendWaybillToFront(updated);
}

/**
 * Delete waybill
 * Signature matches: mockApi.deleteWaybill(id: string, markAsSpoiled: boolean)
 * 
 * Note: markAsSpoiled parameter is currently ignored by backend
 * TODO: implement blank spoiling logic in separate endpoint
 */
export async function deleteWaybill(
    id: string,
    markAsSpoiled: boolean = false
): Promise<void> {
    await http.delete<void>(`/waybills/${id}`);

    // TODO: if markAsSpoiled is true, call separate endpoint to spoil the blank
    // Example: await http.patch(`/blanks/${blankId}/spoil`, { reason: 'waybill_deleted' });
}

/**
 * Update waybill status
 * Signature matches: mockApi.updateWaybillStatus(waybillId: string, status: WaybillStatus)
 */
export async function updateWaybillStatus(
    waybillId: string,
    status: FrontWaybillStatus
): Promise<void> {
    const backendStatus = toBackendStatus(status);

    // Using PATCH endpoint for status update
    await http.patch<BackendWaybillDto>(`/waybills/${waybillId}/status`, {
        status: backendStatus,
    });
}

/**
 * Extended status change with context
 * Signature matches: mockApi.changeWaybillStatus(waybillId, next, ctx)
 */
export async function changeWaybillStatus(
    waybillId: string,
    next: FrontWaybillStatus,
    ctx: { userId?: string; appMode?: string; reason?: string } = {}
): Promise<FrontWaybill> {
    const backendStatus = toBackendStatus(next);

    // Send context as additional fields if backend supports it
    const updated = await http.patch<BackendWaybillDto>(`/waybills/${waybillId}/status`, {
        status: backendStatus,
        // ctx fields can be added if backend supports them
        ...ctx,
    });

    return mapBackendWaybillToFront(updated);
}
