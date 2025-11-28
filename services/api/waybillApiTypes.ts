/**
 * Backend DTO types for Waybill API
 */

import type { FrontWaybillStatus, BackendWaybillStatus } from './waybillStatusMap';

/**
 * Backend DTO from API
 */
export interface BackendWaybillDto {
    id: string;
    organizationId: string;
    departmentId: string | null;
    number: string;
    date: string; // ISO 8601
    vehicleId: string;
    driverId: string;
    blankId: string | null;
    status: BackendWaybillStatus;
    odometerStart: number | null;
    odometerEnd: number | null;
    plannedRoute: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
    // Опционально, если backend включает связанные данные
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
            id: string;
            fullName: string;
        };
        licenseNumber: string;
    };
}

/**
 * Frontend Waybill type (упрощенная версия из types.ts)
 * Используется для совместимости с mockApi
 */
export interface FrontWaybill {
    id: string;
    organizationId: string;
    number: string;
    date: string;
    vehicleId: string;
    driverId: string;
    status: any; // WaybillStatus из types.ts

    // Бланки
    blankId?: string | null;
    blankSeries?: string | null;
    blankNumber?: number | null;

    // Одометр
    odometerStart: number;
    odometerEnd?: number;

    // Топливо
    fuelPlanned?: number;
    fuelAtStart?: number;
    fuelFilled?: number;
    fuelAtEnd?: number;

    // Маршруты
    routes: any[]; // Route[]

    // Прочее
    dispatcherId: string;
    controllerId?: string;
    validFrom: string;
    validTo: string;
    reviewerComment?: string;
    deviationReason?: string;
    notes?: string;

    // Аудит
    createdAt?: string;
    updatedAt?: string;
    submittedBy?: string;
    postedBy?: string;
    postedAt?: string;
    cancelledBy?: string;
    cancelledAt?: string;

    // Для обогащения (используется mockApi)
    organization?: string;
    vehicle?: string;
    driver?: string;
}
