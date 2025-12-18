// Department API Facade - Frontend interface to backend department endpoints
import { httpClient } from '../httpClient';

export interface Department {
    id: string;
    organizationId: string;
    code?: string;
    name: string;
    address?: string;
    createdAt: string;
    updatedAt: string;
}

export interface DepartmentFilters {
    organizationId?: string;
    page?: number;
    limit?: number;
}

export interface DepartmentsResponse {
    departments: Department[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export async function getDepartments(filters: DepartmentFilters = {}): Promise<Department[]> {
    const params = new URLSearchParams();

    if (filters.organizationId) params.append('organizationId', filters.organizationId);
    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));

    const response = await httpClient.get<{ success: boolean; data: DepartmentsResponse }>(
        `/departments?${params.toString()}`
    );

    return response.data.data.departments;
}

export async function getDepartmentById(id: string): Promise<Department> {
    const response = await httpClient.get<{ success: boolean; data: { department: Department } }>(
        `/departments/${id}`
    );
    return response.data.data.department;
}

export async function createDepartment(data: {
    organizationId: string;
    code?: string;
    name: string;
    address?: string;
}): Promise<Department> {
    const response = await httpClient.post<{ success: boolean; data: { department: Department } }>(
        '/departments',
        data
    );
    return response.data.data.department;
}

export async function updateDepartment(id: string, data: Partial<{
    code: string;
    name: string;
    address: string;
}>): Promise<Department> {
    const response = await httpClient.put<{ success: boolean; data: { department: Department } }>(
        `/departments/${id}`,
        data
    );
    return response.data.data.department;
}

export async function deleteDepartment(id: string): Promise<void> {
    await httpClient.delete(`/departments/${id}`);
}
