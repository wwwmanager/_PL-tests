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

    console.log('🔍 [vehicleApi] Calling GET /vehicles with params:', params.toString());
    // httpClient returns data directly (unwrapped)
    const vehiclesArray = await httpClient.get<Vehicle[]>(`/vehicles?${params.toString()}`);
    console.log('🔍 [vehicleApi] GET /vehicles response:', vehiclesArray);
    return vehiclesArray || [];
}

export async function getVehicleById(id: string): Promise<Vehicle> {
    // httpClient returns data directly (unwrapped)
    const vehicle = await httpClient.get<Vehicle>(`/vehicles/${id}`);
    return vehicle;
}

export async function createVehicle(data: Partial<Vehicle>): Promise<Vehicle> {
    // httpClient returns data directly (unwrapped)
    const vehicle = await httpClient.post<Vehicle>('/vehicles', data);
    return vehicle;
}

export async function updateVehicle(data: Partial<Vehicle> & { id: string }): Promise<Vehicle> {
    const { id, ...updateData } = data;
    console.log('📝 [vehicleApi] PUT /vehicles/' + id, 'updateData:', JSON.stringify(updateData, null, 2));
    // Backend now returns the updated vehicle object (updated in WB-201)
    const vehicle = await httpClient.put<Vehicle>(`/vehicles/${id}`, updateData);
    return vehicle;
}

export async function deleteVehicle(id: string): Promise<void> {
    await httpClient.delete(`/vehicles/${id}`);
}

// Re-export from mockApi for now if needed, or implement real ones if backend supports
// For now, VehicleList uses getFuelTypes from mockApi, so we don't need to export it here if we keep hybrid imports.
