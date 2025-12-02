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
async function getRoutesReal(): Promise<any[]> {
    const response = await httpClient.get<{ data: any[] }>('/routes');
    return response.data;
}

async function addRouteReal(data: any): Promise<any> {
    const response = await httpClient.post<{ data: any }>('/routes', data);
    return response.data;
}

async function updateRouteReal(data: any): Promise<any> {
    const response = await httpClient.put<{ data: any }>(`/routes/${data.id}`, data);
    return response.data;
}

async function deleteRouteReal(id: string): Promise<void> {
    await httpClient.delete(`/routes/${id}`);
}

// Facade functions
export async function getRoutes(): Promise<any[]> {
    const useReal = await shouldUseRealApi();
    return useReal ? getRoutesReal() : mockApi.getRoutes();
}

export async function addRoute(data: any): Promise<any> {
    const useReal = await shouldUseRealApi();
    return useReal ? addRouteReal(data) : mockApi.addRoute(data);
}

export async function updateRoute(data: any): Promise<any> {
    const useReal = await shouldUseRealApi();
    return useReal ? updateRouteReal(data) : mockApi.updateRoute(data);
}

export async function deleteRoute(id: string): Promise<void> {
    const useReal = await shouldUseRealApi();
    return useReal ? deleteRouteReal(id) : mockApi.deleteRoute(id);
}
