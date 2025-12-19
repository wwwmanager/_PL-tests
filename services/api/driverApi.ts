import { httpClient } from '../httpClient';

export interface DriverListItem {
    id: string;         // Driver.id
    employeeId: string; // Employee.id
    fullName: string;
    shortName: string | null;
    departmentId: string | null;
    isActive: boolean;
}

/**
 * REL-301: List all drivers for the current organization
 */
export async function listDrivers(departmentId?: string): Promise<DriverListItem[]> {
    const params = new URLSearchParams();
    if (departmentId) params.append('departmentId', departmentId);

    const response = await httpClient.get<DriverListItem[]>(`/drivers?${params.toString()}`);
    return response;
}

/**
 * REL-301: Get driver details by Driver.id
 */
export async function getDriverById(id: string): Promise<DriverListItem> {
    const response = await httpClient.get<DriverListItem>(`/drivers/${id}`);
    return response;
}
