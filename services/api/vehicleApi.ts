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

    // Backend returns Vehicle[] directly, not wrapped
    const response = await httpClient.get<Vehicle[]>(`/vehicles?${params.toString()}`);
    return response.data || [];
}

export async function getVehicleById(id: string): Promise<Vehicle> {
    // Backend returns Vehicle directly, not wrapped
    const response = await httpClient.get<Vehicle>(`/vehicles/${id}`);
    return response.data;
}

export async function createVehicle(data: Partial<Vehicle>): Promise<Vehicle> {
    // Backend returns Vehicle directly, not wrapped
    const response = await httpClient.post<Vehicle>('/vehicles', data);
    return response.data;
}

export async function updateVehicle(data: Partial<Vehicle> & { id: string }): Promise<Vehicle> {
    const { id, ...updateData } = data;
    // Backend returns { message: "Обновлено" }, not the vehicle. This is inconsistent with other endpoints.
    // For now, we'll need to fetch the updated vehicle separately or update backend to return the vehicle.
    const response = await httpClient.put<{ message: string }>(`/vehicles/${id}`, updateData);
    // Fetch the updated vehicle
    return getVehicleById(id);
}

export async function deleteVehicle(id: string): Promise<void> {
    await httpClient.delete(`/vehicles/${id}`);
}

// Re-export from mockApi for now if needed, or implement real ones if backend supports
// For now, VehicleList uses getFuelTypes from mockApi, so we don't need to export it here if we keep hybrid imports.
