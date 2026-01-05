import { httpClient } from '../../services/httpClient';

export interface VehicleModel {
    id: string;
    name: string;
    brand: string;
    model: string;
    type: string;
    fuelStockItemId?: string | null;
    tankCapacity?: number | null;
    summerRate?: number | null;
    winterRate?: number | null;
    tireSize?: string | null;
    rimSize?: string | null;
    manufactureYears?: string | null;
    fuelStockItem?: any;
}

export const getVehicleModels = async () => {
    // Return typed response from httpClient
    const response = await httpClient.get<VehicleModel[]>('/vehicle-models');
    return response;
};

export const getVehicleModel = async (id: string) => {
    const response = await httpClient.get<VehicleModel>(`/vehicle-models/${id}`);
    return response;
};

export const createVehicleModel = async (data: Partial<VehicleModel>) => {
    const response = await httpClient.post<VehicleModel>('/vehicle-models', data);
    return response;
};

export const updateVehicleModel = async (id: string, data: Partial<VehicleModel>) => {
    const response = await httpClient.put<VehicleModel>(`/vehicle-models/${id}`, data);
    return response;
};

export const deleteVehicleModel = async (id: string) => {
    await httpClient.delete(`/vehicle-models/${id}`);
};
