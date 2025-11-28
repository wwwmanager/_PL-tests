/**
 * API для работы с путевыми листами
 */

import { http } from './httpClient';

export type WaybillStatus = 'DRAFT' | 'SUBMITTED' | 'POSTED' | 'CANCELLED';

export interface WaybillDto {
    id: string;
    organizationId: string;
    departmentId: string | null;
    number: string;
    date: string; // ISO 8601
    vehicleId: string;
    driverId: string;
    blankId: string | null;
    status: WaybillStatus;
    odometerStart: number | null;
    odometerEnd: number | null;
    plannedRoute: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
    // Связанные данные (если backend отдает include)
    vehicle?: {
        id: string;
        code: string;
        registrationNumber: string;
        brand: string;
        model: string;
    };
    driver?: {
        id: string;
        employee: {
            fullName: string;
        };
        licenseNumber: string;
    };
}

export interface WaybillRouteDto {
    id: string;
    waybillId: string;
    legOrder: number;
    fromPoint: string;
    toPoint: string;
    distanceKm: number;
    notes: string | null;
}

export interface WaybillFuelDto {
    id: string;
    waybillId: string;
    stockItemId: string;
    fuelStart: number;
    fuelReceived: number;
    fuelConsumed: number;
    fuelEnd: number;
    stockItem?: {
        name: string;
        code: string;
    };
}

export interface CreateWaybillInput {
    number: string;
    date: string; // 'YYYY-MM-DD' or ISO string
    vehicleId: string;
    driverId: string;
    blankId?: string;
    odometerStart?: number;
    plannedRoute?: string;
    notes?: string;
}

export interface UpdateWaybillInput {
    number?: string;
    date?: string;
    vehicleId?: string;
    driverId?: string;
    blankId?: string;
    odometerStart?: number;
    odometerEnd?: number;
    plannedRoute?: string;
    notes?: string;
    status?: WaybillStatus;
}

/**
 * Получить список всех путевых листов
 */
export async function listWaybills(): Promise<WaybillDto[]> {
    return http.get<WaybillDto[]>('/waybills');
}

/**
 * Получить путевой лист по ID
 */
export async function getWaybill(id: string): Promise<WaybillDto> {
    return http.get<WaybillDto>(`/waybills/${id}`);
}

/**
 * Создать новый путевой лист
 */
export async function createWaybill(input: CreateWaybillInput): Promise<WaybillDto> {
    return http.post<WaybillDto>('/waybills', input);
}

/**
 * Обновить путевой лист
 */
export async function updateWaybill(id: string, input: UpdateWaybillInput): Promise<WaybillDto> {
    return http.put<WaybillDto>(`/waybills/${id}`, input);
}

/**
 * Удалить путевой лист
 */
export async function deleteWaybill(id: string): Promise<void> {
    return http.delete<void>(`/waybills/${id}`);
}

/**
 * Изменить статус путевого листа
 */
export async function updateWaybillStatus(id: string, status: WaybillStatus): Promise<WaybillDto> {
    return http.patch<WaybillDto>(`/waybills/${id}/status`, { status });
}

/**
 * Получить маршруты путевого листа
 */
export async function getWaybillRoutes(waybillId: string): Promise<WaybillRouteDto[]> {
    return http.get<WaybillRouteDto[]>(`/waybills/${waybillId}/routes`);
}

/**
 * Получить данные о топливе путевого листа
 */
export async function getWaybillFuel(waybillId: string): Promise<WaybillFuelDto[]> {
    return http.get<WaybillFuelDto[]>(`/waybills/${waybillId}/fuel`);
}
