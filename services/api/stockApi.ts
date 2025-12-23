import { httpClient } from '../httpClient';
import { GarageStockItem, StockLocation, LocationBalance, StockMovementV2 } from '../../types';
import { ApiListResponse } from './core';

export interface StockMovementFilters {
    locationId?: string;
    stockItemId?: string;
    movementType?: string;
    from?: string | Date;
    to?: string | Date;
    search?: string;
    page?: number;
    limit?: number;
}

/**
 * Get all stock items (nomenclature)
 */
export async function getStockItems(isFuel?: boolean): Promise<GarageStockItem[]> {
    const params = new URLSearchParams();
    if (isFuel !== undefined) params.append('isFuel', String(isFuel));

    // Real backend returns ApiResponse { data: T }
    const response = await httpClient.get<{ data: GarageStockItem[] }>(`/stock/items?${params.toString()}`);
    return response.data || [];
}

/**
 * Get all stock locations (Warehouses, Fuel Cards, Vehicles)
 */
export async function getStockLocations(): Promise<StockLocation[]> {
    const response = await httpClient.get<{ data: StockLocation[] }>('/stock/locations');
    return response.data || [];
}

/**
 * Get stock movements with filters
 */
export async function getStockMovements(filters: StockMovementFilters = {}): Promise<ApiListResponse<StockMovementV2>> {
    const params = new URLSearchParams();
    if (filters.locationId) params.append('locationId', filters.locationId);
    if (filters.stockItemId) params.append('stockItemId', filters.stockItemId);
    if (filters.movementType) params.append('movementType', filters.movementType);
    if (filters.from) params.append('from', filters.from instanceof Date ? filters.from.toISOString() : filters.from);
    if (filters.to) params.append('to', filters.to instanceof Date ? filters.to.toISOString() : filters.to);
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));

    const response = await httpClient.get<ApiListResponse<StockMovementV2>>(`/stock/movements?${params.toString()}`);
    return response;
}

/**
 * Get balances at a specific date
 */
export async function getStockBalances(stockItemId?: string, asOf?: string | Date): Promise<LocationBalance[]> {
    const params = new URLSearchParams();
    if (stockItemId) params.append('stockItemId', stockItemId);
    if (asOf) params.append('asOf', asOf instanceof Date ? asOf.toISOString() : asOf);

    const response = await httpClient.get<{ data: LocationBalance[] }>(`/stock/balances?${params.toString()}`);
    return response.data || [];
}

/**
 * Create a new stock movement
 */
export async function createStockMovement(data: Partial<StockMovementV2> & { occurredAt?: string | Date }): Promise<StockMovementV2> {
    // Normalize date to ISO string
    const o = data.occurredAt as any;
    const normalizedDate: string | undefined = (o instanceof Date) ? o.toISOString() : (o || undefined);

    const payload: any = {
        ...data,
        occurredAt: normalizedDate,
    };

    // REL-102 + BE-002: Backend expects fromLocationId/toLocationId instead of fromStockLocationId/toStockLocationId
    if (data.movementType === 'TRANSFER') {
        payload.fromLocationId = data.fromStockLocationId || (data as any).fromLocationId;
        payload.toLocationId = data.toStockLocationId || (data as any).toLocationId;
        // Remove old field names to avoid sending both
        delete payload.fromStockLocationId;
        delete payload.toStockLocationId;
    }

    // Convert quantity to string for backend Decimal compatibility
    if (typeof payload.quantity === 'number') {
        payload.quantity = String(payload.quantity);
    }

    const response = await httpClient.post<{ data: StockMovementV2 }>('/stock/movements/v2', payload);
    return response.data;
}

/**
 * Delete a stock movement
 * REL-203: Added for movement management
 */
export async function deleteStockMovement(id: string): Promise<void> {
    await httpClient.delete(`/stock/movements/${id}`);
}

/**
 * Update a stock movement (V2)
 */
export async function updateStockMovementV2(id: string, params: Partial<StockMovementV2> & {
    movementType?: 'INCOME' | 'EXPENSE' | 'ADJUSTMENT' | 'TRANSFER';
    stockLocationId?: string;
    fromLocationId?: string;
    toLocationId?: string;
    externalRef?: string;
    comment?: string;
}): Promise<StockMovementV2> {
    const payload: any = {
        ...params,
    };

    // Convert quantity to string for backend Decimal compatibility if needed
    if (typeof payload.quantity === 'number') {
        payload.quantity = String(payload.quantity);
    }

    // Normalize date
    if (payload.occurredAt instanceof Date) {
        payload.occurredAt = payload.occurredAt.toISOString();
    }

    const response = await httpClient.put<{ data: StockMovementV2 }>(`/stock/movements/${id}`, payload);
    return response.data;
}
