/**
 * Warehouse API Facade
 * 
 * Uses real backend API for all warehouse/storage operations.
 * Driver Mode with mockApi has been removed.
 */

import { httpClient } from './httpClient';

interface ApiResponse<T> {
    data: T;
}

// Storage type matching backend model
export interface Storage {
    id: string;
    organizationId: string;
    type: 'fuel_tank' | 'warehouse' | 'other';
    name: string;
    description?: string;
    address?: string;
    responsiblePerson?: string;
    fuelType?: string;
    capacityLiters?: number;
    currentLevelLiters?: number;
    safetyStockLiters?: number;
    createdAt: string;
    updatedAt: string;
    status: 'active' | 'archived';
}

export async function getWarehouses(): Promise<Storage[]> {
    console.log('📡 [warehouseApi] Fetching from BACKEND /warehouses...');
    const response = await httpClient.get<ApiResponse<Storage[]>>('/warehouses');
    const warehouses = response.data || [];
    console.log('📡 [warehouseApi] Received from backend:', warehouses.length, 'warehouses');
    return warehouses;
}

export async function addWarehouse(data: Omit<Storage, 'id'>): Promise<Storage> {
    const response = await httpClient.post<ApiResponse<Storage>>('/warehouses', data);
    return response.data;
}

export async function updateWarehouse(data: Storage): Promise<Storage> {
    const response = await httpClient.put<ApiResponse<Storage>>(`/warehouses/${data.id}`, data);
    return response.data;
}

export async function deleteWarehouse(id: string): Promise<void> {
    await httpClient.delete(`/warehouses/${id}`);
}

// Aliases for compatibility with StorageManagement.tsx which uses mockApi names
export const fetchStorages = getWarehouses;
export const addStorage = addWarehouse;
export const updateStorage = updateWarehouse;
export const deleteStorage = deleteWarehouse;
