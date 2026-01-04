// Waybill API Facade
import { httpClient } from '../httpClient';
import { Waybill } from '../../types';
import { mapBackendWaybillToFront } from './waybillMapper';
import { BackendWaybillDto } from './waybillApiTypes';

export interface WaybillFilters {
    organizationId?: string;
    startDate?: string;
    endDate?: string;
    driverId?: string;
    vehicleId?: string;
    status?: string;
    page?: number;
    limit?: number;
}

export interface WaybillsResponse {
    waybills: Waybill[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    pagination?: {
        total: number;
        page: number;
        limit: number;
        pages: number;
    };
}

export async function getWaybills(filters: WaybillFilters = {}): Promise<WaybillsResponse> {
    const params = new URLSearchParams();
    if (filters.organizationId) params.append('organizationId', filters.organizationId);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.driverId) params.append('driverId', filters.driverId);
    if (filters.vehicleId) params.append('vehicleId', filters.vehicleId);
    if (filters.status) params.append('status', filters.status);
    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));

    const response = await httpClient.get<{ data: BackendWaybillDto[]; pagination: { total: number; page: number; limit: number; pages: number } }>(
        `/waybills?${params.toString()}`
    );

    // REL-103: Apply mapper to convert startAt->validFrom
    const mappedWaybills = response.data.map(mapBackendWaybillToFront);

    // Adapt new backend format {data, pagination} to old WaybillsResponse format
    return {
        waybills: mappedWaybills,
        total: response.pagination.total,
        page: response.pagination.page,
        limit: response.pagination.limit,
        totalPages: response.pagination.pages,
        pagination: response.pagination
    };
}

export async function getWaybillById(id: string): Promise<Waybill> {
    const response = await httpClient.get<BackendWaybillDto>(`/waybills/${id}`);
    // REL-103: Apply mapper to convert startAt->validFrom
    return mapBackendWaybillToFront(response);
}

export async function createWaybill(data: Partial<Waybill>): Promise<Waybill> {
    const response = await httpClient.post<Waybill>('/waybills', data);
    return response;
}

export async function updateWaybill(id: string, data: Partial<Waybill>): Promise<Waybill> {
    const response = await httpClient.put<Waybill>(`/waybills/${id}`, data);
    return response;
}

export async function deleteWaybill(id: string, blankAction: 'return' | 'spoil' = 'return'): Promise<void> {
    await httpClient.delete(`/waybills/${id}?blankAction=${blankAction}`);
}

export async function bulkDeleteWaybills(ids: string[]): Promise<{ success: string[]; errors: { id: string; error: string }[] }> {
    return httpClient.post<{ success: string[]; errors: { id: string; error: string }[] }>('/waybills/bulk-delete', { ids });
}

/**
 * WB-BULK-POST: Bulk change status for multiple waybills
 * WB-BULK-SEQ: Extended with stoppedDueToError and skippedIds
 */
export interface BulkStatusResult {
    success: number;
    failed: { id: string; number: string; error: string }[];
    stoppedDueToError?: boolean;  // WB-BULK-SEQ: Processing was halted due to error
    skippedIds?: string[];        // WB-BULK-SEQ: IDs that were skipped after error
}

export async function bulkChangeWaybillStatus(
    ids: string[],
    status: string,
    reason?: string
): Promise<BulkStatusResult> {
    return httpClient.patch<BulkStatusResult>('/waybills/bulk-status', { ids, status, reason });
}

export async function getLatestWaybill(): Promise<Waybill | null> {
    const response = await getWaybills({ limit: 1 });
    return response.waybills[0] || null;
}

export async function getLastWaybillForVehicle(vehicleId: string): Promise<Waybill | null> {
    const response = await getWaybills({ vehicleId, limit: 1 });
    return response.waybills[0] || null;
}

export async function changeWaybillStatus(id: string, status: string, options?: { reason?: string }): Promise<Waybill> {
    const response = await httpClient.patch<Waybill>(`/waybills/${id}/status`, {
        status,
        reason: options?.reason
    });
    return response;
}

// WB-PREFILL-020: Prefill Data
export interface WaybillPrefillData {
    driverId: string | null;
    dispatcherEmployeeId: string | null;
    controllerEmployeeId: string | null;
    odometerStart: number | null;
    fuelStart: number | null;
    fuelStockItemId: string | null;
    tankBalance: number | null;
    lastWaybillId: string | null;
    lastWaybillNumber: string | null;
    lastWaybillDate: string | null;
}

export async function getWaybillPrefill(vehicleId: string, date?: string): Promise<WaybillPrefillData> {
    const params = new URLSearchParams();
    if (date) params.append('date', date);

    return await httpClient.get<WaybillPrefillData>(`/waybills/prefill/${vehicleId}?${params.toString()}`);
}

export { createWaybill as addWaybill };
