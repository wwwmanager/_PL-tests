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
    // FUEL-CARD-AUTO-001
    fuelCardId?: string | null;
    fuelCard?: { id: string; cardNumber: string; provider?: string; balanceLiters?: number } | null;
    blankId: string | null;
    status: BackendWaybillStatus;
    odometerStart: number | null;
    odometerEnd: number | null;
    plannedRoute: string | null;
    notes: string | null;
    fuelCalculationMethod?: string; // BOILER, SEGMENTS, MIXED
    createdAt: string;
    updatedAt: string;
    // WB-FIX-PL-001
    dispatcherEmployeeId?: string | null;
    controllerEmployeeId?: string | null;
    validTo?: string | null; // from backend validTo
    startAt?: string | null;  // departure date/time (REL-103)
    endAt?: string | null;    // return date/time (REL-103)
    fuel?: {
        stockItemId: string | null;
        fuelStart: number | null;
        fuelReceived: number | null;
        fuelConsumed: number | null;
        fuelEnd: number | null;
        fuelPlanned: number | null;
        refueledAt: string | null; // ISO
        sourceType: string | null;
        comment: string | null;
    };
    routes?: Array<{
        id: string;
        legOrder: number;
        routeId: string | null;
        fromPoint: string | null;
        toPoint: string | null;
        distanceKm: number | null;
        isCityDriving: boolean | null;
        isWarming: boolean | null;
        comment: string | null;
        date?: string | null; // WB-REPORT-001: Added for medical exam calculation
    }>;
    fuelLines?: Array<{
        id: string;
        stockItemId: string;
        fuelStart: number | null;
        fuelReceived: number | null;
        fuelConsumed: number | null;
        fuelEnd: number | null;
        fuelPlanned: number | null;
    }>;
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
    number?: string;
    date: string;
    vehicleId: string;
    driverId: string;
    // FUEL-CARD-AUTO-001: Fuel card assigned to this waybill
    fuelCardId?: string | null;
    fuelCard?: { id: string; cardNumber: string; provider?: string; balanceLiters?: number } | null;
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
    fuelLines?: any[]; // FUEL-CARD-AUTO-001: Added for consistency with backend DTO and Waybill type

    // Прочее
    dispatcherId?: string; // Made optional for deprecated compat
    controllerId?: string;
    // WB-FIX-PL-001
    dispatcherEmployeeId?: string | null;
    controllerEmployeeId?: string | null;

    validFrom: string;
    validTo: string;

    fuel?: {
        stockItemId: string | null;
        fuelStart: string | number | null;
        fuelReceived: string | number | null;
        fuelConsumed: string | number | null;
        fuelEnd: string | number | null;
        fuelPlanned: string | number | null;
        refueledAt: string | null;
        sourceType: string | null;
        comment: string | null;
    };
    reviewerComment?: string;
    deviationReason?: string;
    notes?: string;
    fuelCalculationMethod?: 'BOILER' | 'SEGMENTS' | 'MIXED';

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
