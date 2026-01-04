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

interface GetWaybillsParams {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    vehicleId?: string;
    driverId?: string;
}

interface PaginatedWaybillsResponse {
    waybills: FrontWaybill[];
    pagination?: {
        total: number;
        page: number;
        limit: number;
        pages: number;
    };
}

/**
 * Get all waybills with optional filtering and pagination
 */
export async function getWaybills(params?: GetWaybillsParams): Promise<PaginatedWaybillsResponse> {
    // Build query string from params
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.vehicleId) queryParams.append('vehicleId', params.vehicleId);
    if (params?.driverId) queryParams.append('driverId', params.driverId);

    const queryString = queryParams.toString();
    const url = queryString ? `/waybills?${queryString}` : '/waybills';

    const response = await http.get<{
        data: BackendWaybillDto[];
        pagination?: {
            total: number;
            page: number;
            limit: number;
            pages: number;
        };
    }>(url);

    // Map backend waybills to frontend format
    const waybills = response.data.map(mapBackendWaybillToFront);

    return {
        waybills,
        pagination: response.pagination,
    };
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
 * Signature matches: mockApi.deleteWaybill(id: string, blankAction: 'return' | 'spoil')
 * 
 * @param id - Waybill ID
 * @param blankAction - What to do with the blank: 'return' (back to driver) or 'spoil' (mark as damaged)
 */
export async function deleteWaybill(
    id: string,
    blankAction: 'return' | 'spoil' = 'return'
): Promise<void> {
    await http.delete<void>(`/waybills/${id}?blankAction=${blankAction}`);
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
