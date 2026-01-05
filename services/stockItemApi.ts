/**
 * REL-203: Stock Item (Nomenclature) API
 * 
 * CRUD operations for unified stock items catalog
 */

import { httpClient } from './httpClient';

// Stock Item Category matching backend enum
export type StockItemCategory = 'FUEL' | 'MATERIAL' | 'SPARE_PART' | 'SERVICE' | 'OTHER';

export interface StockItem {
    id: string;
    organizationId: string;
    departmentId: string; // Required
    code: string;         // Required
    name: string;
    unit: string;
    isFuel: boolean;
    density?: number | null;
    categoryEnum?: StockItemCategory | null;
    category?: string | null; // Deprecated
    fuelTypeLegacyId?: string | null;
    group?: string | null;
    description?: string | null;
    brandId?: string | null;
    avgCost?: number | null;
    balance: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    // Relations
    fuelType?: { id: string; code: string; name: string } | null;
    department?: { id: string; name: string } | null;
    brand?: { id: string; name: string } | null;
}

export interface StockItemCreateInput {
    code: string;
    name: string;
    unit?: string;
    isFuel?: boolean;
    density?: number;
    categoryEnum?: StockItemCategory;
    departmentId: string;
    group?: string;
    description?: string;
    brandId?: string;
    initialBalance?: number;
    storageLocationId?: string;
}

export interface StockItemUpdateInput {
    code?: string;
    name?: string;
    unit?: string;
    isFuel?: boolean;
    density?: number;
    categoryEnum?: StockItemCategory;
    departmentId?: string | null;
    isActive?: boolean;
    group?: string;
    description?: string;
    brandId?: string | null;
}

export interface StockItemFilter {
    categoryEnum?: StockItemCategory;
    category?: string;
    isFuel?: boolean;
    isActive?: boolean;
    search?: string;
}

interface ApiResponse<T> {
    data: T;
}

/**
 * Get all stock items with optional filters
 */
export async function getStockItems(filter?: StockItemFilter): Promise<StockItem[]> {
    const params = new URLSearchParams();
    if (filter?.categoryEnum) params.append('categoryEnum', filter.categoryEnum);
    if (filter?.category) params.append('category', filter.category);
    if (filter?.isFuel !== undefined) params.append('isFuel', String(filter.isFuel));
    if (filter?.isActive !== undefined) params.append('isActive', String(filter.isActive));
    if (filter?.search) params.append('search', filter.search);

    const query = params.toString();
    const url = query ? `/stock-items?${query}` : '/stock-items';

    console.log('📡 [stockItemApi] Fetching from', url);
    const response = await httpClient.get<ApiResponse<StockItem[]>>(url);
    return response.data || [];
}

/**
 * Get fuel items only (shorthand)
 */
export async function getFuelItems(): Promise<StockItem[]> {
    return getStockItems({ categoryEnum: 'FUEL', isActive: true });
}

/**
 * Get stock item by ID
 */
export async function getStockItemById(id: string): Promise<StockItem | null> {
    const response = await httpClient.get<StockItem>(`/stock-items/${id}`);
    return response || null;
}

/**
 * Create new stock item
 */
export async function createStockItem(data: StockItemCreateInput): Promise<StockItem> {
    const response = await httpClient.post<StockItem>('/stock-items', data);
    return response;
}

/**
 * Update stock item
 */
export async function updateStockItem(id: string, data: StockItemUpdateInput): Promise<StockItem> {
    const response = await httpClient.put<StockItem>(`/stock-items/${id}`, data);
    return response;
}

/**
 * Soft-delete stock item
 */
export async function deleteStockItem(id: string): Promise<void> {
    await httpClient.delete(`/stock-items/${id}`);
}
