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
async function getWarehousesReal(): Promise<any[]> {
    const response = await httpClient.get<{ data: any[] }>('/warehouses');
    return response.data;
}

async function addWarehouseReal(data: any): Promise<any> {
    const response = await httpClient.post<{ data: any }>('/warehouses', data);
    return response.data;
}

async function updateWarehouseReal(data: any): Promise<any> {
    const response = await httpClient.put<{ data: any }>(`/warehouses/${data.id}`, data);
    return response.data;
}

async function deleteWarehouseReal(id: string): Promise<void> {
    await httpClient.delete(`/warehouses/${id}`);
}

// Facade functions
export async function getWarehouses(): Promise<any[]> {
    const useReal = await shouldUseRealApi();
    return useReal ? getWarehousesReal() : mockApi.getWarehouses();
}

export async function addWarehouse(data: any): Promise<any> {
    const useReal = await shouldUseRealApi();
    return useReal ? addWarehouseReal(data) : mockApi.addWarehouse(data);
}

export async function updateWarehouse(data: any): Promise<any> {
    const useReal = await shouldUseRealApi();
    return useReal ? updateWarehouseReal(data) : mockApi.updateWarehouse(data);
}

export async function deleteWarehouse(id: string): Promise<void> {
    const useReal = await shouldUseRealApi();
    return useReal ? deleteWarehouseReal(id) : mockApi.deleteWarehouse(id);
}
