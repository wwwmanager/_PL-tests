/**
 * Employee API Facade
 * 
 * Uses real backend API for all employee operations.
 * Driver Mode with mockApi has been removed.
 */

import { Employee } from '../types';
import * as realEmployeeApi from './api/employeeApi';

// Re-export all functions from realEmployeeApi
export const getEmployees = realEmployeeApi.getEmployees;
export const getEmployeeById = realEmployeeApi.getEmployeeById;
export const createEmployee = realEmployeeApi.createEmployee;

export async function updateEmployee(data: Employee): Promise<Employee> {
    return realEmployeeApi.updateEmployee(data.id, data);
}

export const deleteEmployee = realEmployeeApi.deleteEmployee;
