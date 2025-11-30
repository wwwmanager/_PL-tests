// Vehicle API Facade
import { httpClient } from '../httpClient';
import { Vehicle } from '../../types';

export interface VehicleFilters {
    organizationId?: string;
    page?: number;
    limit?: number;
}

export async function getVehicles(filters: VehicleFilters = {}): Promise<Vehicle[]> {
    const params = new URLSearchParams();
    if (filters.organizationId) params.append('organizationId', filters.organizationId);

    const response = await httpClient.get<Vehicle[]>(`/vehicles?${params.toString()}`);
    return response.data;
}

export async function getVehicleById(id: string): Promise<Vehicle> {
    const response = await httpClient.get<Vehicle>(`/vehicles/${id}`);
    return response.data;
}

export async function createVehicle(data: Partial<Vehicle>): Promise<Vehicle> {
    const response = await httpClient.post<Vehicle>('/vehicles', data);
    return response.data;
}

export async function updateVehicle(data: Partial<Vehicle> & { id: string }): Promise<Vehicle> {
    const { id, ...updateData } = data;
    const response = await httpClient.put<Vehicle>(`/vehicles/${id}`, updateData);
    return response.data; // Assuming backend returns updated vehicle or message
}

export async function deleteVehicle(id: string): Promise<void> {
    await httpClient.delete(`/vehicles/${id}`);
}

// Re-export from mockApi for now if needed, or implement real ones if backend supports
// For now, VehicleList uses getFuelTypes from mockApi, so we don't need to export it here if we keep hybrid imports.
