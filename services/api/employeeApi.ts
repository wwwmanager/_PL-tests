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

/**
 * Allowed fields for Employee create/update
 * Filters out: organizationId (from JWT), blankBatches (computed), id, createdAt, updatedAt, relations
 */
const ALLOWED_EMPLOYEE_FIELDS = [
    'fullName', 'shortName', 'position', 'phone', 'email', 'address', 'dateOfBirth',
    'personnelNumber', 'snils', 'notes',
    'employeeType', 'status', 'isActive',
    'departmentId', 'dispatcherId', 'controllerId', 'medicalInstitutionId',
    'documentNumber', 'documentExpiry', 'licenseCategory',
    'driverCardType', 'driverCardNumber', 'driverCardStartDate', 'driverCardExpiryDate',
    'medicalCertificateSeries', 'medicalCertificateNumber', 'medicalCertificateIssueDate', 'medicalCertificateExpiryDate',
    'fuelCardNumber', 'fuelCardBalance',
] as const;

// Fields that should be converted from "" to null (dates, unique fields, etc.)
const NULLABLE_IF_EMPTY_FIELDS = [
    'dateOfBirth', 'documentExpiry',
    'driverCardStartDate', 'driverCardExpiryDate',
    'medicalCertificateIssueDate', 'medicalCertificateExpiryDate',
    'fuelCardNumber', // unique constraint - empty string would cause duplicate errors
    'shortName', 'email', 'phone', 'address',
    'departmentId', 'dispatcherId', 'controllerId', 'medicalInstitutionId',
];

function sanitizeEmployeePayload(data: Record<string, unknown>): Record<string, unknown> {
    const filtered = Object.fromEntries(
        Object.entries(data).filter(([key]) => (ALLOWED_EMPLOYEE_FIELDS as readonly string[]).includes(key))
    );

    // Convert empty strings to null for specific fields
    for (const field of NULLABLE_IF_EMPTY_FIELDS) {
        if (field in filtered && filtered[field] === '') {
            filtered[field] = null;
        }
    }

    return filtered;
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

export async function createEmployee(data: Partial<Employee> | Record<string, unknown>): Promise<Employee> {
    const payload = sanitizeEmployeePayload(data as Record<string, unknown>);
    console.log('👤 [employeeApi] createEmployee sanitized payload:', JSON.stringify(payload, null, 2));

    const response = await httpClient.post<{ success: boolean; data: { employee: Employee } }>(
        '/employees',
        payload
    );
    return response.data.employee;
}

export async function updateEmployee(id: string, data: Partial<Employee> | Record<string, unknown>): Promise<Employee> {
    const payload = sanitizeEmployeePayload(data as Record<string, unknown>);
    console.log('👤 [employeeApi] updateEmployee sanitized payload:', JSON.stringify(payload, null, 2));

    const response = await httpClient.put<{ success: boolean; data: { employee: Employee } }>(
        `/employees/${id}`,
        payload
    );
    return response.data.employee;
}

export async function deleteEmployee(id: string): Promise<void> {
    await httpClient.delete(`/employees/${id}`);
}

