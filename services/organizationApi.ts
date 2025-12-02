import * as mockApi from './mockApi';
import { getAppSettings } from './mockApi';
import { Organization } from '../types';
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
async function getOrganizationsReal(): Promise<Organization[]> {
    const response = await httpClient.get<{ data: Organization[] }>('/organizations');
    return response.data;
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
