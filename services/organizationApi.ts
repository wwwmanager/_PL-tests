import * as mockApi from './mockApi';
import { getAppSettings } from './mockApi';
import { Organization } from '../types';
import { httpClient, getAccessToken } from './httpClient';

async function shouldUseRealApi(): Promise<boolean> {
    // Если есть токен авторизации — пользователь работает с backend, используем real API
    const hasToken = !!getAccessToken();

    try {
        const settings = await getAppSettings();
        // Если appMode не установлен (undefined) — используем real API если залогинен
        const useReal = settings.appMode === 'central' || (settings.appMode === undefined && hasToken);

        console.log(`🔗 [organizationApi] appMode = "${settings.appMode}", hasToken = ${hasToken} → ${useReal ? 'REAL BACKEND' : 'MOCK API (IndexedDB)'}`);

        return useReal;
    } catch (error) {
        // Если есть токен — используем real API
        console.warn('⚠️ [organizationApi] Could not load AppSettings, hasToken:', hasToken);
        return hasToken || !import.meta.env.DEV;
    }
}

// Real API implementations
async function getOrganizationsReal(): Promise<Organization[]> {
    console.log('📡 [organizationApi] Fetching from BACKEND /organizations...');
    const response = await httpClient.get<{ data: Organization[] }>('/organizations');
    const organizations = response.data || [];
    console.log('📡 [organizationApi] Received from backend:', organizations.length, 'organizations');
    return organizations;
}

async function addOrganizationReal(data: Omit<Organization, 'id'>): Promise<Organization> {
    const response = await httpClient.post<{ data: Organization }>('/organizations', data);
    return response.data;
}

async function updateOrganizationReal(data: Organization): Promise<Organization> {
    const response = await httpClient.put<{ data: Organization }>(`/organizations/${data.id}`, data);
    return response.data;
}

async function deleteOrganizationReal(id: string): Promise<void> {
    await httpClient.delete(`/organizations/${id}`);
}

// Facade functions
export async function getOrganizations(): Promise<Organization[]> {
    const useReal = await shouldUseRealApi();
    return useReal ? getOrganizationsReal() : mockApi.getOrganizations();
}

export async function addOrganization(data: Omit<Organization, 'id'>): Promise<Organization> {
    const useReal = await shouldUseRealApi();
    return useReal ? addOrganizationReal(data) : mockApi.addOrganization(data);
}

export async function updateOrganization(data: Organization): Promise<Organization> {
    const useReal = await shouldUseRealApi();
    return useReal ? updateOrganizationReal(data) : mockApi.updateOrganization(data);
}

export async function deleteOrganization(id: string): Promise<void> {
    const useReal = await shouldUseRealApi();
    return useReal ? deleteOrganizationReal(id) : mockApi.deleteOrganization(id);
}
