/**
 * Organization API Facade
 * 
 * Uses real backend API for all organization operations.
 * Driver Mode with mockApi has been removed.
 */

import { Organization } from '../types';
import { httpClient } from './httpClient';

export async function getOrganizations(): Promise<Organization[]> {
    console.log('📡 [organizationApi] Fetching from BACKEND /organizations...');
    const response = await httpClient.get<{ data: Organization[] }>('/organizations');
    const organizations = response.data || [];
    console.log('📡 [organizationApi] Received from backend:', organizations.length, 'organizations');
    return organizations;
}

export async function addOrganization(data: Omit<Organization, 'id'>): Promise<Organization> {
    const response = await httpClient.post<{ data: Organization }>('/organizations', data);
    return response.data;
}

export async function updateOrganization(data: Organization): Promise<Organization> {
    const response = await httpClient.put<{ data: Organization }>(`/organizations/${data.id}`, data);
    return response.data;
}

export async function deleteOrganization(id: string): Promise<void> {
    await httpClient.delete(`/organizations/${id}`);
}
