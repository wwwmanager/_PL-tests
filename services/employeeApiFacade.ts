// Employee API Facade with dynamic switching based on appMode
import { Employee } from '../types';
import * as mockApi from './mockApi';
import * as realEmployeeApi from './api/employeeApi';
import { getAppSettings } from './mockApi';

// Dynamic switching based on appMode
async function shouldUseRealAPI(): Promise<boolean> {
    const settings = await getAppSettings();
    return settings?.appMode === 'central';
}

export async function getEmployees(): Promise<Employee[]> {
    const useReal = await shouldUseRealAPI();
    if (useReal) {
        return realEmployeeApi.getEmployees();
    }
    return mockApi.getEmployees();
}

export async function getEmployeeById(id: string): Promise<Employee | undefined> {
    const useReal = await shouldUseRealAPI();
    if (useReal) {
        return realEmployeeApi.getEmployeeById(id);
    }
    const employees = await mockApi.getEmployees();
    return employees.find(e => e.id === id);
}

export async function createEmployee(data: Partial<Employee>): Promise<Employee> {
    const useReal = await shouldUseRealAPI();
    if (useReal) {
        return realEmployeeApi.createEmployee(data);
    }
    return mockApi.addEmployee(data as Omit<Employee, 'id'>);
}

export async function updateEmployee(data: Employee): Promise<Employee> {
    const useReal = await shouldUseRealAPI();
    if (useReal) {
        return realEmployeeApi.updateEmployee(data.id, data);
    }
    return mockApi.updateEmployee(data);
}

export async function deleteEmployee(id: string): Promise<void> {
    const useReal = await shouldUseRealAPI();
    if (useReal) {
        return realEmployeeApi.deleteEmployee(id);
    }
    return mockApi.deleteEmployee(id);
}
