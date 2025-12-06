import * as mockApi from './mockApi';
import { getAppSettings, MockStorage } from './mockApi';
import { httpClient, getAccessToken } from './httpClient';

interface ApiResponse<T> {
    data: T;
}

async function shouldUseRealApi(): Promise<boolean> {
    const hasToken = !!getAccessToken();

    try {
        const settings = await getAppSettings();
        const useReal = settings.appMode === 'central' || (settings.appMode === undefined && hasToken);

        console.log(`🔗 [warehouseApi] appMode = "${settings.appMode}", hasToken = ${hasToken} → ${useReal ? 'REAL BACKEND' : 'MOCK API'}`);

        return useReal;
    } catch (error) {
        console.warn('⚠️ [warehouseApi] Could not load AppSettings, hasToken:', hasToken);
        return hasToken || !import.meta.env.DEV;
    }
}

// Real API implementations
async function getWarehousesReal(): Promise<MockStorage[]> {
    console.log('📡 [warehouseApi] Fetching from BACKEND /warehouses...');
    const response = await httpClient.get<ApiResponse<MockStorage[]>>('/warehouses');
    const warehouses = response.data || [];
    console.log('📡 [warehouseApi] Received from backend:', warehouses.length, 'warehouses');
    return warehouses;
}

async function addWarehouseReal(data: Omit<MockStorage, 'id'>): Promise<MockStorage> {
    const response = await httpClient.post<ApiResponse<MockStorage>>('/warehouses', data);
    return response.data;
}

async function updateWarehouseReal(data: MockStorage): Promise<MockStorage> {
    const response = await httpClient.put<ApiResponse<MockStorage>>(`/warehouses/${data.id}`, data);
    return response.data;
}

async function deleteWarehouseReal(id: string): Promise<void> {
    await httpClient.delete(`/warehouses/${id}`);
}

// Facade functions
export async function getWarehouses(): Promise<MockStorage[]> {
    const useReal = await shouldUseRealApi();
    if (useReal) {
        return getWarehousesReal();
    }
    // mockApi.fetchStorages returns ApiListResponse with pagination
    const response = await mockApi.fetchStorages({ perPage: 9999 });
    return response.data;
}

export async function addWarehouse(data: Omit<MockStorage, 'id'>): Promise<MockStorage> {
    const useReal = await shouldUseRealApi();
    return useReal ? addWarehouseReal(data) : mockApi.addStorage(data);
}

export async function updateWarehouse(data: MockStorage): Promise<MockStorage> {
    const useReal = await shouldUseRealApi();
    return useReal ? updateWarehouseReal(data) : mockApi.updateStorage(data);
}

export async function deleteWarehouse(id: string): Promise<void> {
    const useReal = await shouldUseRealApi();
    return useReal ? deleteWarehouseReal(id) : mockApi.deleteStorage(id);
}

// Aliases for compatibility with StorageManagement.tsx which uses mockApi names
export const fetchStorages = getWarehouses;
export const addStorage = addWarehouse;
export const updateStorage = updateWarehouse;
export const deleteStorage = deleteWarehouse;
