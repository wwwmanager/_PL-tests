/**
 * Mapper functions to convert between backend DTO and frontend Waybill types
 */

import { fromBackendStatus, toBackendStatus } from './waybillStatusMap';
import type { BackendWaybillDto, FrontWaybill } from './waybillApiTypes';
import { WaybillStatus } from '../../types';

/**
 * Convert backend DTO to frontend Waybill format
 */
export function mapBackendWaybillToFront(dto: BackendWaybillDto): FrontWaybill {
    const frontStatus = fromBackendStatus(dto.status);

    // Преобразуем lowercase статус в enum
    let enumStatus: WaybillStatus;
    switch (frontStatus) {
        case 'draft':
            enumStatus = WaybillStatus.DRAFT;
            break;
        case 'submitted':
            enumStatus = WaybillStatus.SUBMITTED;
            break;
        case 'posted':
            enumStatus = WaybillStatus.POSTED;
            break;
        case 'cancelled':
            enumStatus = WaybillStatus.CANCELLED;
            break;
        default:
            enumStatus = WaybillStatus.DRAFT;
    }

    return {
        id: dto.id,
        organizationId: dto.organizationId,
        number: dto.number,
        date: dto.date,
        vehicleId: dto.vehicleId,
        driverId: dto.driverId,
        status: enumStatus,

        // Бланк
        blankId: dto.blankId,

        // Одометр
        odometerStart: dto.odometerStart ?? 0,
        odometerEnd: dto.odometerEnd ?? undefined,

        // Маршрут
        routes: [], // Будет загружаться отдельно

        // Заметки
        notes: dto.notes ?? undefined,

        // Обязательные поля для совместимости с mockApi
        dispatcherId: '', // TODO: добавить в backend
        validFrom: dto.date,
        validTo: dto.date,

        // Аудит
        createdAt: dto.createdAt,
        updatedAt: dto.updatedAt,

        // Обогащенные данные (если есть)
        organization: undefined,
        vehicle: dto.vehicle ? `${dto.vehicle.brand} ${dto.vehicle.registrationNumber}` : undefined,
        driver: dto.driver ? dto.driver.employee.fullName : undefined,
    };
}

/**
 * Convert frontend Waybill to backend DTO format for creation
 */
export function mapFrontWaybillToBackendCreate(waybill: Omit<FrontWaybill, 'id'>): {
    number: string;
    date: string;
    vehicleId: string;
    driverId: string;
    blankId?: string | null;
    odometerStart?: number | null;
    odometerEnd?: number | null;
    plannedRoute?: string | null;
    notes?: string | null;
} {
    // Собираем plannedRoute из маршрутов
    const plannedRoute = waybill.routes && waybill.routes.length > 0
        ? waybill.routes.map((r: any) => `${r.from} → ${r.to}`).join(', ')
        : null;

    return {
        number: waybill.number,
        date: waybill.date,
        vehicleId: waybill.vehicleId,
        driverId: waybill.driverId,
        blankId: waybill.blankId ?? null,
        odometerStart: waybill.odometerStart ?? null,
        odometerEnd: waybill.odometerEnd ?? null,
        plannedRoute,
        notes: waybill.notes ?? null,
    };
}

/**
 * Convert frontend Waybill to backend DTO format for update
 */
export function mapFrontWaybillToBackendUpdate(waybill: FrontWaybill): {
    number: string;
    date: string;
    vehicleId: string;
    driverId: string;
    blankId?: string | null;
    odometerStart: number | null;
    odometerEnd: number | null;
    plannedRoute: string | null;
    notes: string | null;
    status: string;
} {
    // Преобразуем enum статус в строку
    let statusStr: string;
    switch (waybill.status) {
        case WaybillStatus.DRAFT:
            statusStr = 'draft';
            break;
        case WaybillStatus.SUBMITTED:
            statusStr = 'submitted';
            break;
        case WaybillStatus.POSTED:
        case WaybillStatus.COMPLETED: // Обратная совместимость
            statusStr = 'posted';
            break;
        case WaybillStatus.CANCELLED:
            statusStr = 'cancelled';
            break;
        default:
            statusStr = 'draft';
    }

    const plannedRoute = waybill.routes && waybill.routes.length > 0
        ? waybill.routes.map((r: any) => `${r.from} → ${r.to}`).join(', ')
        : null;

    return {
        number: waybill.number,
        date: waybill.date,
        vehicleId: waybill.vehicleId,
        driverId: waybill.driverId,
        blankId: waybill.blankId ?? null,
        odometerStart: waybill.odometerStart ?? null,
        odometerEnd: waybill.odometerEnd ?? null,
        plannedRoute,
        notes: waybill.notes ?? null,
        status: toBackendStatus(statusStr as any),
    };
}
