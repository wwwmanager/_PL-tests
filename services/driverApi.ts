/**
 * API для работы с водителями
 */

import { http } from './httpClient';

export interface DriverDto {
    id: string;
    employeeId: string;
    licenseNumber: string;
    licenseCategory: string;
    licenseValidTo: string; // ISO 8601
    notes: string | null;
    createdAt: string;
    updatedAt: string;
    employee: {
        id: string;
        fullName: string;
        position: string;
        phone: string | null;
        organizationId: string;
        departmentId: string | null;
    };
}

export interface CreateDriverInput {
    employeeId: string;
    licenseNumber: string;
    licenseCategory: string;
    licenseValidTo: string; // 'YYYY-MM-DD' or ISO string
    notes?: string;
}

export interface UpdateDriverInput {
    licenseNumber?: string;
    licenseCategory?: string;
    licenseValidTo?: string;
    notes?: string;
}

/**
 * Получить список всех водителей
 */
export async function listDrivers(): Promise<DriverDto[]> {
    return http.get<DriverDto[]>('/drivers');
}

/**
 * Получить водителя по ID
 */
export async function getDriver(id: string): Promise<DriverDto> {
    return http.get<DriverDto>(`/drivers/${id}`);
}

/**
 * Создать нового водителя
 */
export async function createDriver(input: CreateDriverInput): Promise<DriverDto> {
    return http.post<DriverDto>('/drivers', input);
}

/**
 * Обновить водителя
 */
export async function updateDriver(id: string, input: UpdateDriverInput): Promise<DriverDto> {
    return http.put<DriverDto>(`/drivers/${id}`, input);
}

/**
 * Удалить водителя
 */
export async function deleteDriver(id: string): Promise<void> {
    return http.delete<void>(`/drivers/${id}`);
}
