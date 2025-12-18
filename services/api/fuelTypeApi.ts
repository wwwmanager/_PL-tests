// FuelType API Facade
import { httpClient } from '../httpClient';
import { FuelType } from '../../types';

/**
 * Get all fuel types
 */
export async function getFuelTypes(): Promise<FuelType[]> {
    const response = await httpClient.get<{ data: FuelType[] }>('/fuel-types');
    // Backend returns: {data: [...]}
    // httpClient.get returns the full response object
    return response.data || [];
}

/**
 * Get fuel type by ID
 */
export async function getFuelTypeById(id: string): Promise<FuelType> {
    const response = await httpClient.get<{ data: FuelType }>(`/fuel-types/${id}`);
    return response.data;
}

/**
 * Create new fuel type
 */
export async function createFuelType(data: {
    code: string;
    name: string;
    density?: number | null;
}): Promise<FuelType> {
    const response = await httpClient.post<{ data: FuelType }>('/fuel-types', data);
    return response.data;
}

/**
 * Update fuel type
 */
export async function updateFuelType(id: string, data: {
    code?: string;
    name?: string;
    density?: number | null;
}): Promise<FuelType> {
    const response = await httpClient.put<{ data: FuelType }>(`/fuel-types/${id}`, data);
    return response.data;
}

/**
 * Delete fuel type
 */
export async function deleteFuelType(id: string): Promise<void> {
    await httpClient.delete(`/fuel-types/${id}`);
}
