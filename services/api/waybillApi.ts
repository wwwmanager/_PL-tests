// Waybill API Facade
import { httpClient } from '../httpClient';
import { Waybill } from '../../types';

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

    const response = await httpClient.get<{ data: Waybill[]; pagination: { total: number; page: number; limit: number; pages: number } }>(
        `/waybills?${params.toString()}`
    );

    // Adapt new backend format {data, pagination} to old WaybillsResponse format
    return {
        waybills: response.data,
        total: response.pagination.total,
        page: response.pagination.page,
        limit: response.pagination.limit,
        totalPages: response.pagination.pages,
        pagination: response.pagination
    };
}

export async function getWaybillById(id: string): Promise<Waybill> {
    const response = await httpClient.get<Waybill>(`/waybills/${id}`);
    return response;
}

export async function createWaybill(data: Partial<Waybill>): Promise<Waybill> {
    const response = await httpClient.post<Waybill>('/waybills', data);
    return response;
}

export async function updateWaybill(id: string, data: Partial<Waybill>): Promise<Waybill> {
    const response = await httpClient.put<Waybill>(`/waybills/${id}`, data);
    return response;
}

export async function deleteWaybill(id: string): Promise<void> {
    await httpClient.delete(`/waybills/${id}`);
}

export async function getLatestWaybill(): Promise<Waybill | null> {
    const response = await getWaybills({ limit: 1 });
    return response.waybills[0] || null;
}

export async function getLastWaybillForVehicle(vehicleId: string): Promise<Waybill | null> {
    const response = await getWaybills({ vehicleId, limit: 1 });
    return response.waybills[0] || null;
}

export async function changeWaybillStatus(id: string, status: string): Promise<Waybill> {
    const response = await httpClient.patch<Waybill>(`/waybills/${id}/status`, { status });
    return response;
}

export { createWaybill as addWaybill };
