/**
 * FuelType API Facade
 * 
 * Uses real backend API for all fuel type operations.
 * Driver Mode with mockApi has been removed.
 */

import { httpClient } from './httpClient';

// Real API implementations
export async function getFuelTypes(): Promise<any[]> {
    const response = await httpClient.get<{ data: any[] }>('/fuel-types');
    return response.data;
}

export async function addFuelType(data: any): Promise<any> {
    const response = await httpClient.post<{ data: any }>('/fuel-types', data);
    return response.data;
}

export async function updateFuelType(data: any): Promise<any> {
    const response = await httpClient.put<{ data: any }>(`/fuel-types/${data.id}`, data);
    return response.data;
}

export async function deleteFuelType(id: string): Promise<void> {
    await httpClient.delete(`/fuel-types/${id}`);
}
