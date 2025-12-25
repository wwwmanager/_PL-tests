/**
 * Mapper functions to convert between backend DTO and frontend Waybill types
 */
import { fromBackendStatus, toBackendStatus } from './waybillStatusMap';
import type { BackendWaybillDto, FrontWaybill } from './waybillApiTypes';
import { WaybillStatus } from '../../types';

/** Normalize id: '' -> null, '   ' -> null, string -> trimmed, undefined -> undefined */
const normalizeId = (v: unknown): string | null | undefined => {
    if (v === undefined) return undefined;
    if (v === null) return null;
    if (typeof v !== 'string') return null;
    const s = v.trim();
    return s ? s : null;
};

/**
 * Convert datetime-local or ISO or date-only to ISO datetime or null.
 * - 'YYYY-MM-DD' -> ISO at endOfDay (local) by default
 * - 'YYYY-MM-DDTHH:mm' -> ISO
 * - ISO -> ISO
 */
function normalizeToIsoDateTimeOrNull(
    v: unknown,
    opts?: { dateOnlyMode?: 'startOfDay' | 'endOfDay' }
): string | null {
    const dateOnlyMode = opts?.dateOnlyMode ?? 'endOfDay';

    if (v === null || v === undefined) return null;
    if (typeof v !== 'string') return null;

    const s = v.trim();
    if (!s) return null;

    if (s.includes('T')) {
        const d = new Date(s);
        return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }

    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;

    const yyyy = Number(m[1]);
    const mm = Number(m[2]);
    const dd = Number(m[3]);

    const d =
        dateOnlyMode === 'startOfDay'
            ? new Date(yyyy, mm - 1, dd, 0, 0, 0, 0)
            : new Date(yyyy, mm - 1, dd, 23, 59, 0, 0);

    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Convert backend DTO to frontend Waybill format
 */
export function mapBackendWaybillToFront(dto: BackendWaybillDto): FrontWaybill {
    const frontStatus = fromBackendStatus(dto.status);

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
        date: dto.date, // backend may return ISO or date-only; UI обычно режет до YYYY-MM-DD где нужно
        vehicleId: dto.vehicleId,
        driverId: dto.driverId,
        // FUEL-CARD-AUTO-001
        fuelCardId: dto.fuelCardId ?? null,
        fuelCard: dto.fuelCard ?? null,
        status: enumStatus,

        blankId: dto.blankId ?? null,

        odometerStart: dto.odometerStart ?? 0,
        odometerEnd: dto.odometerEnd ?? undefined,

        routes: (dto.routes ?? []).map((r) => ({
            id: r.id,
            from: r.fromPoint ?? '',
            to: r.toPoint ?? '',
            distanceKm: Number(r.distanceKm) || 0,
            isCityDriving: !!r.isCityDriving,
            isWarming: !!r.isWarming,
            comment: r.comment ?? undefined,
        })),

        notes: dto.notes ?? undefined,
        fuelCalculationMethod: (dto.fuelCalculationMethod as any) || 'BOILER',

        // Primary fields
        dispatcherEmployeeId: dto.dispatcherEmployeeId ?? null,
        controllerEmployeeId: dto.controllerEmployeeId ?? null,

        // Legacy compat (если где-то UI ещё читает dispatcherId)
        dispatcherId: dto.dispatcherEmployeeId ?? '',

        // validFrom: use startAt (departure time) if present, else fallback to date
        // DEBUG: trace startAt value
        ...(() => { console.log('[MAPPER] dto:', dto.number, 'startAt:', dto.startAt, 'date:', dto.date); return {}; })(),
        validFrom: dto.startAt ?? dto.date,
        validTo: dto.validTo ?? dto.endAt ?? dto.date,

        fuel: dto.fuel ?? undefined,
        // REL-103: Pass fuelLines for WaybillList (fuelAtStart/fuelAtEnd columns)
        fuelLines: dto.fuelLines,

        createdAt: dto.createdAt,
        updatedAt: dto.updatedAt,

        organization: undefined,
        vehicle: dto.vehicle ? `${dto.vehicle.brand} ${dto.vehicle.registrationNumber}` : undefined,
        driver: dto.driver ? dto.driver.employee.fullName : undefined,
    };
}

/**
 * Convert frontend Waybill to backend DTO format for creation
 */
export function mapFrontWaybillToBackendCreate(waybill: Omit<FrontWaybill, 'id'>) {
    const plannedRoute =
        waybill.routes && waybill.routes.length > 0
            ? waybill.routes.map((r: any) => `${r.from} → ${r.to}`).join(', ')
            : null;

    const dispatcherEmployeeId = normalizeId((waybill as any).dispatcherEmployeeId) ?? normalizeId((waybill as any).dispatcherId);
    const controllerEmployeeId = normalizeId((waybill as any).controllerEmployeeId) ?? normalizeId((waybill as any).controllerId);

    return {
        number: waybill.number || undefined,

        // date строго date-only (backend regex). Если UI держит ISO — режьте выше в UI.
        date: waybill.date,

        vehicleId: waybill.vehicleId,
        driverId: waybill.driverId,

        blankId: waybill.blankId ?? null,

        odometerStart: waybill.odometerStart ?? null,
        odometerEnd: waybill.odometerEnd ?? null,

        plannedRoute,
        notes: waybill.notes ?? null,

        fuelCalculationMethod: waybill.fuelCalculationMethod || 'BOILER',

        dispatcherEmployeeId: dispatcherEmployeeId ?? null,
        controllerEmployeeId: controllerEmployeeId ?? null,

        // startAt = departure datetime (from validFrom)
        startAt: normalizeToIsoDateTimeOrNull((waybill as any).validFrom, { dateOnlyMode: 'startOfDay' }),
        // validTo в backend DTO = ISO datetime (z.string().datetime()) или null/undefined
        validTo: normalizeToIsoDateTimeOrNull((waybill as any).validTo, { dateOnlyMode: 'endOfDay' }),

        fuel: (waybill as any).fuel,

        routes: (waybill.routes || []).map((r: any, index: number) => ({
            legOrder: index,
            fromPoint: r.from,
            toPoint: r.to,
            distanceKm: r.distanceKm,
            isCityDriving: !!r.isCityDriving,
            isWarming: !!r.isWarming,
            comment: r.notes ?? r.comment ?? null,
        })),
    };
}

/**
 * Convert frontend Waybill to backend DTO format for update
 */
export function mapFrontWaybillToBackendUpdate(waybill: FrontWaybill) {
    let statusStr: string;
    switch (waybill.status) {
        case WaybillStatus.DRAFT:
            statusStr = 'draft';
            break;
        case WaybillStatus.SUBMITTED:
            statusStr = 'submitted';
            break;
        case WaybillStatus.POSTED:
            statusStr = 'posted';
            break;
        case WaybillStatus.CANCELLED:
            statusStr = 'cancelled';
            break;
        default:
            statusStr = 'draft';
    }

    const plannedRoute =
        waybill.routes && waybill.routes.length > 0
            ? waybill.routes.map((r: any) => `${r.from} → ${r.to}`).join(', ')
            : null;

    const dispatcherEmployeeId = normalizeId((waybill as any).dispatcherEmployeeId) ?? normalizeId((waybill as any).dispatcherId);
    const controllerEmployeeId = normalizeId((waybill as any).controllerEmployeeId) ?? normalizeId((waybill as any).controllerId);

    return {
        number: waybill.number || undefined,
        date: waybill.date,

        vehicleId: waybill.vehicleId,
        driverId: waybill.driverId,

        blankId: waybill.blankId ?? null,

        odometerStart: waybill.odometerStart ?? null,
        odometerEnd: waybill.odometerEnd ?? null,

        plannedRoute,
        notes: waybill.notes ?? null,

        status: toBackendStatus(statusStr as any),

        fuelCalculationMethod: waybill.fuelCalculationMethod || 'BOILER',

        dispatcherEmployeeId: dispatcherEmployeeId ?? null,
        controllerEmployeeId: controllerEmployeeId ?? null,

        // startAt = departure datetime (from validFrom)
        startAt: normalizeToIsoDateTimeOrNull((waybill as any).validFrom, { dateOnlyMode: 'startOfDay' }),
        validTo: normalizeToIsoDateTimeOrNull((waybill as any).validTo, { dateOnlyMode: 'endOfDay' }),

        fuel: (waybill as any).fuel,

        routes: (waybill.routes || []).map((r: any, index: number) => ({
            legOrder: index,
            fromPoint: r.from,
            toPoint: r.to,
            distanceKm: r.distanceKm,
            isCityDriving: !!r.isCityDriving,
            isWarming: !!r.isWarming,
            comment: r.notes ?? r.comment ?? null,
        })),
    };
}
