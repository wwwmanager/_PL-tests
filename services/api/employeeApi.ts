import { httpClient } from '../httpClient';
import { Employee } from '../../types';

export interface EmployeeFilters {
    organizationId?: string;
    departmentId?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
}

export interface EmployeesResponse {
    employees: Employee[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export async function getEmployees(filters: EmployeeFilters = {}): Promise<Employee[]> {
    const params = new URLSearchParams();

    if (filters.organizationId) params.append('organizationId', filters.organizationId);
    if (filters.departmentId) params.append('departmentId', filters.departmentId);
    if (filters.isActive !== undefined) params.append('isActive', String(filters.isActive));
    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));

    const response = await httpClient.get<{ success: boolean; data: EmployeesResponse }>(
        `/employees?${params.toString()}`
    );

    // httpClient already unwraps response.data, so backend { success: true, data: {...} } becomes response.data
    return response.data?.employees || [];
}

export async function getEmployeeById(id: string): Promise<Employee> {
    const response = await httpClient.get<{ success: boolean; data: { employee: Employee } }>(
        `/employees/${id}`
    );
    return response.data.employee;
}

export async function createEmployee(data: Partial<Employee>): Promise<Employee> {
    const response = await httpClient.post<{ success: boolean; data: { employee: Employee } }>(
        '/employees',
        data
    );
    return response.data.employee;
}

export async function updateEmployee(id: string, data: Partial<{
    departmentId: string;
    fullName: string;
    position: string;
    personnelNumber: string;
    isActive: boolean;
}>): Promise<Employee> {
    const response = await httpClient.put<{ success: boolean; data: { employee: Employee } }>(
        `/employees/${id}`,
        data
    );
    return response.data.employee;
}

export async function deleteEmployee(id: string): Promise<void> {
    await httpClient.delete(`/employees/${id}`);
}
