/**
 * API для работы с транспортными средствами
 */

import { http } from './httpClient';

/**
 * Нормы расхода топлива для транспортного средства
 * Соответствует backend Vehicle.fuelConsumptionRates (WB-101, WB-201)
 */
export interface FuelConsumptionRates {
    /** Норма расхода зимой (л/100км) */
    winterRate?: number;
    /** Норма расхода летом (л/100км) */
    summerRate?: number;
    /** Процент увеличения при городской езде */
    cityIncreasePercent?: number;
    /** Процент увеличения при прогреве */
    warmingIncreasePercent?: number;
}

export interface VehicleDto {
    id: string;
    organizationId: string;
    departmentId: string | null;
    code: string;
    registrationNumber: string;
    brand: string;
    model: string;
    vin: string | null;
    year: number | null;
    fuelType: string | null;
    fuelTankCapacity: number | null;
    fuelConsumptionRates: FuelConsumptionRates | null;
    notes: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CreateVehicleInput {
    code: string;
    registrationNumber: string;
    brand: string;
    model: string;
    departmentId?: string;
    vin?: string;
    year?: number;
    fuelType?: string;
    fuelTankCapacity?: number;
    fuelConsumptionRates?: FuelConsumptionRates;
    notes?: string;
    isActive?: boolean;
}

export interface UpdateVehicleInput {
    code?: string;
    registrationNumber?: string;
    brand?: string;
    model?: string;
    departmentId?: string;
    vin?: string;
    year?: number;
    fuelType?: string;
    fuelTankCapacity?: number;
    fuelConsumptionRates?: FuelConsumptionRates | null;
    notes?: string;
    isActive?: boolean;
}

/**
 * Получить список всех транспортных средств
 */
export async function listVehicles(): Promise<VehicleDto[]> {
    return http.get<VehicleDto[]>('/vehicles');
}

/**
 * Получить транспортное средство по ID
 */
export async function getVehicle(id: string): Promise<VehicleDto> {
    return http.get<VehicleDto>(`/vehicles/${id}`);
}

/**
 * Создать новое транспортное средство
 */
export async function createVehicle(input: CreateVehicleInput): Promise<VehicleDto> {
    return http.post<VehicleDto>('/vehicles', input);
}

/**
 * Обновить транспортное средство
 */
export async function updateVehicle(id: string, input: UpdateVehicleInput): Promise<VehicleDto> {
    return http.put<VehicleDto>(`/vehicles/${id}`, input);
}

/**
 * Удалить транспортное средство
 */
export async function deleteVehicle(id: string): Promise<void> {
    return http.delete<void>(`/vehicles/${id}`);
}
