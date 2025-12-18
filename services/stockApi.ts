/**
 * Stock API Facade
 * 
 * Uses real backend API for all stock item and movement operations.
 * Replaces mockApi stock functions.
 */

import { httpClient } from './httpClient';
import type { GarageStockItem, StockTransaction, StockTransactionItem } from '../types';

// ==================== TYPES ====================

interface ApiResponse<T> {
    data: T;
}

// Backend StockItem model
interface BackendStockItem {
    id: string;
    organizationId: string;
    code: string | null;
    name: string;
    unit: string;
    isFuel: boolean;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

// Backend StockMovement model
interface BackendStockMovement {
    id: string;
    organizationId: string;
    warehouseId: string | null;
    stockItemId: string;
    movementType: 'INCOME' | 'EXPENSE' | 'ADJUSTMENT';
    quantity: number;
    documentType: string | null;
    documentId: string | null;
    comment: string | null;
    createdByUserId: string | null;
    createdAt: string;
    stockItem?: BackendStockItem;
}

// ==================== MAPPERS ====================

function mapBackendItemToFrontend(item: BackendStockItem): GarageStockItem {
    return {
        id: item.id,
        name: item.name,
        code: item.code || undefined,
        unit: item.unit,
        itemType: 'Товар',
        group: item.isFuel ? 'ГСМ' : 'Прочее',
        balance: 0, // Will be calculated from movements
        storageType: 'centralWarehouse',
        isActive: item.isActive,
        organizationId: item.organizationId,
        fuelTypeId: item.isFuel ? item.id : undefined, // Simplified
    };
}

function mapBackendMovementToFrontend(movement: BackendStockMovement): StockTransaction {
    return {
        id: movement.id,
        docNumber: movement.id.slice(0, 8), // Generate doc number from id
        date: movement.createdAt.split('T')[0],
        type: movement.movementType === 'INCOME' ? 'income' : 'expense',
        items: [{
            stockItemId: movement.stockItemId,
            quantity: movement.quantity,
        }],
        waybillId: movement.documentType === 'waybill' ? movement.documentId : null,
        notes: movement.comment || undefined,
        organizationId: movement.organizationId,
    };
}

// ==================== STOCK ITEMS API ====================

/**
 * Get all stock items (garage nomenclature)
 */
export async function getGarageStockItems(isFuel?: boolean): Promise<GarageStockItem[]> {
    console.log('📡 [stockApi] Fetching stock items from backend...');
    let url = '/stock/items';
    if (isFuel !== undefined) {
        url += `?isFuel=${isFuel}`;
    }
    const response = await httpClient.get<ApiResponse<BackendStockItem[]>>(url);
    const items = (response.data || []).map(mapBackendItemToFrontend);
    console.log('📡 [stockApi] Received', items.length, 'stock items');
    return items;
}

/**
 * Add a new stock item
 */
export async function addGarageStockItem(data: Omit<GarageStockItem, 'id'>): Promise<GarageStockItem> {
    console.log('📡 [stockApi] Creating stock item:', data.name);
    const response = await httpClient.post<ApiResponse<BackendStockItem>>('/stock/items', {
        name: data.name,
        code: data.code,
        unit: data.unit,
        isFuel: data.group === 'ГСМ' || !!data.fuelTypeId,
        isActive: data.isActive,
    });
    return mapBackendItemToFrontend(response.data);
}

/**
 * Update an existing stock item
 */
export async function updateGarageStockItem(data: GarageStockItem): Promise<GarageStockItem> {
    console.log('📡 [stockApi] Updating stock item:', data.id);
    const response = await httpClient.put<ApiResponse<BackendStockItem>>(`/stock/items/${data.id}`, {
        name: data.name,
        code: data.code,
        unit: data.unit,
        isFuel: data.group === 'ГСМ' || !!data.fuelTypeId,
        isActive: data.isActive,
    });
    return mapBackendItemToFrontend(response.data);
}

/**
 * Delete a stock item
 */
export async function deleteGarageStockItem(id: string): Promise<void> {
    console.log('📡 [stockApi] Deleting stock item:', id);
    await httpClient.delete(`/stock/items/${id}`);
}

// ==================== STOCK MOVEMENTS (TRANSACTIONS) API ====================

/**
 * Get all stock transactions
 */
export async function getStockTransactions(): Promise<StockTransaction[]> {
    console.log('📡 [stockApi] Fetching stock movements from backend...');
    const response = await httpClient.get<ApiResponse<BackendStockMovement[]>>('/stock/movements');
    const transactions = (response.data || []).map(mapBackendMovementToFrontend);
    console.log('📡 [stockApi] Received', transactions.length, 'movements');
    return transactions;
}

/**
 * Add a new stock transaction
 */
export async function addStockTransaction(data: Omit<StockTransaction, 'id'>): Promise<StockTransaction> {
    console.log('📡 [stockApi] Creating stock movement:', data.type);
    const response = await httpClient.post<ApiResponse<BackendStockMovement>>('/stock/movements', {
        movementType: data.type,
        items: data.items,
        warehouseId: null,
        documentType: data.waybillId ? 'waybill' : null,
        documentId: data.waybillId || null,
        comment: data.notes,
    });
    return mapBackendMovementToFrontend(response.data);
}

/**
 * Update a stock transaction
 */
export async function updateStockTransaction(data: StockTransaction): Promise<StockTransaction> {
    console.log('📡 [stockApi] Updating stock movement:', data.id);
    const firstItem = data.items[0];
    const response = await httpClient.put<ApiResponse<BackendStockMovement>>(`/stock/movements/${data.id}`, {
        stockItemId: firstItem?.stockItemId,
        movementType: data.type,
        quantity: firstItem?.quantity || 0,
        documentType: data.waybillId ? 'waybill' : null,
        documentId: data.waybillId || null,
        comment: data.notes,
    });
    return mapBackendMovementToFrontend(response.data);
}

/**
 * Delete a stock transaction
 */
export async function deleteStockTransaction(id: string): Promise<void> {
    console.log('📡 [stockApi] Deleting stock movement:', id);
    await httpClient.delete(`/stock/movements/${id}`);
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Get fuel card balance for a driver
 */
export async function getFuelCardBalance(driverId: string): Promise<number> {
    try {
        const response = await httpClient.get<ApiResponse<{ balance: number }>>(`/stock/fuel-card-balance/${driverId}`);
        return response.data?.balance || 0;
    } catch {
        return 0;
    }
}

/**
 * Get available fuel expenses for a driver
 */
export async function getAvailableFuelExpenses(
    driverId: string,
    organizationId: string,
    waybillId?: string
): Promise<StockTransaction[]> {
    try {
        const params = new URLSearchParams();
        if (waybillId) params.append('waybillId', waybillId);
        const response = await httpClient.get<ApiResponse<BackendStockMovement[]>>(
            `/stock/available-fuel-expenses/${driverId}?${params.toString()}`
        );
        return (response.data || []).map(mapBackendMovementToFrontend);
    } catch {
        return [];
    }
}

/**
 * Get next waybill number (simple increment)
 */
export async function getNextWaybillNumber(organizationId: string): Promise<string> {
    // For now, generate a simple number based on timestamp
    // In production, this should query the backend for the last waybill number
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const seq = String(Math.floor(Math.random() * 1000)).padStart(4, '0');
    return `${year}${month}${day}-${seq}`;
}
