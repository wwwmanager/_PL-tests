import * as mockApi from './mockApi';
import { getAppSettings } from './mockApi';
import { httpClient } from './httpClient';

async function shouldUseRealApi(): Promise<boolean> {
    try {
        const settings = await getAppSettings();
        return settings.appMode === 'central';
    } catch {
        return !import.meta.env.DEV;
    }
}

// Real API implementations
async function getFuelTypesReal(): Promise<any[]> {
    const response = await httpClient.get<{ data: any[] }>('/fuel-types');
    return response.data;
}

async function addFuelTypeReal(data: any): Promise<any> {
    const response = await httpClient.post<{ data: any }>('/fuel-types', data);
    return response.data;
}

async function updateFuelTypeReal(data: any): Promise<any> {
    const response = await httpClient.put<{ data: any }>(`/fuel-types/${data.id}`, data);
    return response.data;
}

async function deleteFuelTypeReal(id: string): Promise<void> {
    await httpClient.delete(`/fuel-types/${id}`);
}

// Facade functions
export async function getFuelTypes(): Promise<any[]> {
    const useReal = await shouldUseRealApi();
    return useReal ? getFuelTypesReal() : mockApi.getFuelTypes();
}

export async function addFuelType(data: any): Promise<any> {
    const useReal = await shouldUseRealApi();
    return useReal ? addFuelTypeReal(data) : mockApi.addFuelType(data);
}

export async function updateFuelType(data: any): Promise<any> {
    const useReal = await shouldUseRealApi();
    return useReal ? updateFuelTypeReal(data) : mockApi.updateFuelType(data);
}

export async function deleteFuelType(id: string): Promise<void> {
    const useReal = await shouldUseRealApi();
    return useReal ? deleteFuelTypeReal(id) : mockApi.deleteFuelType(id);
}
