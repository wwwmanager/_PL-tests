import { PrismaClient, Prisma, WaybillStatus, BlankStatus } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { validateOdometer, calculateDistanceKm, calculatePlannedFuelByMethod, FuelConsumptionRates, FuelCalculationMethod, FuelSegment } from '../domain/waybill/fuel';
import { isWinterDate } from '../utils/dateUtils';
import { getSeasonSettings, getAppSettings } from './settingsService';
import { reserveNextBlankForDriver, reserveSpecificBlank, releaseBlank, spoilBlank } from './blankService';
// REL-103: Stock location imports (used by postingService)
import { getOrCreateVehicleTankLocation } from './stockLocationService';
import { createTransfer, createExpenseMovement, getBalanceAt } from './stockService';
import { stornoDocument, executeStorno } from './stornoService';
import { findActiveCardForDriver } from './fuelCardService';
// POSTING-SVC-010: Import PostingService
import { postWaybill, cancelWaybill } from './postingService';
// PERIOD-LOCK-001: Import period lock check
import { checkPeriodLock } from './periodLockService';

const prisma = new PrismaClient();

export interface UserInfo {
    id: string;
    organizationId: string;
    departmentId: string | null;
    role: string;
    employeeId: string | null;
}

interface FuelLineInput {
    stockItemId: string;
    fuelStart?: number;
    fuelReceived?: number;
    fuelConsumed?: number;
    fuelEnd?: number;
    fuelPlanned?: number;
    isFuel?: boolean; // Added helper for planned assignment
}

export interface CreateWaybillInput {
    number?: string; // WB-901: Made optional as backend will assign it from blank
    date: string;
    vehicleId: string;
    driverId: string;
    blankId?: string | null;
    odometerStart?: number;
    odometerEnd?: number;
    isCityDriving?: boolean;
    isWarming?: boolean;
    plannedRoute?: string;
    // WB-FIX-PL-001
    dispatcherEmployeeId?: string;
    controllerEmployeeId?: string;
    // REL-103: Departure and return datetime
    startAt?: string;
    endAt?: string;
    validTo?: string;

    routes?: Array<{
        legOrder: number;
        routeId?: string | null;
        fromPoint?: string;
        toPoint?: string;
        distanceKm?: number;
        isCityDriving?: boolean;
        isWarming?: boolean;
        isMountainDriving?: boolean;  // COEF-MOUNTAIN-001
        comment?: string;
        date?: string;  // WB-ROUTE-DATE: Route-specific date for multi-day waybills
    }>;
    // Flattened fuel input for WB-FIX-PL-001
    fuel?: {
        stockItemId: string | null;
        fuelStart?: number | null;
        fuelReceived?: number | null;
        fuelConsumed?: number | null;
        fuelEnd?: number | null;
        fuelPlanned?: number | null;
        refueledAt?: string | null;
        sourceType?: string | null;
        comment?: string | null;
    };
    notes?: string;
    fuelCalculationMethod?: FuelCalculationMethod;
    fuelLines?: FuelLineInput[];
}

interface ListWaybillsFilters {
    startDate?: string;
    endDate?: string;
    vehicleId?: string;
    driverId?: string;
    status?: WaybillStatus;
    departmentId?: string;
    search?: string; // поиск по номеру ПЛ
}

interface PaginationParams {
    page?: number;
    limit?: number;
}

export async function listWaybills(
    userInfo: UserInfo,
    filters?: ListWaybillsFilters,
    pagination?: PaginationParams
) {
    const organizationId = userInfo.organizationId;
    const where: any = {
        organizationId,
    };

    // WB-906: Restriction for driver role
    if (userInfo.role === 'driver' && userInfo.employeeId) {
        // Find Driver record for this employee
        const driver = await prisma.driver.findUnique({
            where: { employeeId: userInfo.employeeId }
        });
        if (driver) {
            where.driverId = driver.id;
        } else {
            // No driver record -> no waybills to see
            return { data: [], pagination: { total: 0, page: 1, limit: pagination?.limit ?? 50, pages: 0 } };
        }
    }

    if (filters) {
        if (filters.startDate) {
            where.date = { ...where.date, gte: new Date(filters.startDate) };
        }
        if (filters.endDate) {
            where.date = { ...where.date, lte: new Date(filters.endDate) };
        }
        if (filters.vehicleId) {
            where.vehicleId = filters.vehicleId;
        }
        if (filters.driverId) {
            where.driverId = filters.driverId;
        }
        if (filters.status) {
            where.status = filters.status;
        }
        if (filters.departmentId) {
            where.departmentId = filters.departmentId;
        }
        if (filters.search) {
            where.number = { contains: filters.search, mode: 'insensitive' };
        }
    }

    // Pagination defaults
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 50;
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const total = await prisma.waybill.count({ where });

    // Get data
    const data = await prisma.waybill.findMany({
        where,
        orderBy: { number: 'asc' }, // UX: First waybill at top
        skip,
        take: limit,
        include: {
            vehicle: true,
            driver: {
                include: {
                    employee: true
                }
            },
            blank: true, // WB-901
            fuelLines: true, // WB-LIST-070
            routes: true // WB-ROUTES-040: Needed for medical exam calculation
        }
    });

    // WB-LIST-070: Map data to include flattened fuel fields for UI
    const mappedData = data.map(wb => {
        // Calculate totals from fuel lines (defaults to 0 if no lines)
        const fuelAtStart = wb.fuelLines.reduce((sum, line) => sum + Number(line.fuelStart || 0), 0);
        const fuelAtEnd = wb.fuelLines.reduce((sum, line) => sum + Number(line.fuelEnd || 0), 0);

        return {
            ...wb,
            // Return null if there are no fuel lines, otherwise return the calculated value
            // (even if it is 0, because 0 is a valid fuel amount)
            fuelAtStart: wb.fuelLines.length > 0 ? fuelAtStart : null,
            fuelAtEnd: wb.fuelLines.length > 0 ? fuelAtEnd : null
        };
    });

    return {
        data: mappedData,
        pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit)
        }
    };
}

export async function getWaybillById(userInfo: UserInfo, id: string) {
    const organizationId = userInfo.organizationId;
    const where: any = { id, organizationId };

    // WB-906: Driver can only see their own waybills
    if (userInfo.role === 'driver' && userInfo.employeeId) {
        const driver = await prisma.driver.findUnique({
            where: { employeeId: userInfo.employeeId }
        });
        if (driver) {
            where.driverId = driver.id;
        } else {
            return null;
        }
    }

    const waybill = await prisma.waybill.findFirst({
        where,
        // @ts-ignore: VehicleModel relation is new
        include: {
            vehicle: { include: { vehicleModel: true } },
            driver: {
                include: {
                    employee: true
                }
            },
            blank: true, // WB-901
            fuelCard: { select: { id: true, cardNumber: true, provider: true, balanceLiters: true } }, // FUEL-CARD-AUTO-001
            fuelLines: true, // WB-901
            routes: true, // WB-ROUTES-040
            dispatcherEmployee: true,
            controllerEmployee: true
        }
    }) as any;

    if (!waybill) return null;

    if (waybill.vehicle) {
        waybill.vehicle = applyVehicleFallbacks(waybill.vehicle);
    }

    // B1: Flatten fuel for frontend (WB-FIX-PL-001)
    // Select aggregate deterministically: refueledAt desc nulls last, then id desc
    // Since we don't have ORDER BY in include, we sort here.
    let fuelAgg = null;
    if (waybill.fuelLines && waybill.fuelLines.length > 0) {
        const sorted = [...waybill.fuelLines].sort((a, b) => {
            const timeA = a.refueledAt ? a.refueledAt.getTime() : 0;
            const timeB = b.refueledAt ? b.refueledAt.getTime() : 0;
            if (timeA !== timeB) return timeB - timeA; // desc
            return b.id.localeCompare(a.id); // desc
        });
        fuelAgg = sorted[0];
    }

    return {
        ...waybill,
        fuel: {
            stockItemId: fuelAgg?.stockItemId || null,
            fuelStart: fuelAgg?.fuelStart || null,
            fuelReceived: fuelAgg?.fuelReceived || null,
            fuelConsumed: fuelAgg?.fuelConsumed || null,
            fuelEnd: fuelAgg?.fuelEnd || null,
            fuelPlanned: fuelAgg?.fuelPlanned || null,
            refueledAt: fuelAgg?.refueledAt ? fuelAgg.refueledAt.toISOString() : null,
            sourceType: fuelAgg?.sourceType || null,
            comment: fuelAgg?.comment || null,
        }
    };
}

function formatBlankNumber(series: string | null, number: number): string {
    const s = series || '';
    const n = number.toString().padStart(6, '0');
    return s ? `${s} ${n}` : n;
}

function applyVehicleFallbacks(vehicle: any) {
    if (!vehicle || !vehicle.vehicleModel) return vehicle;

    // Fallback for Tank Capacity
    if (vehicle.fuelTankCapacity === null || vehicle.fuelTankCapacity === undefined) {
        if (vehicle.vehicleModel.tankCapacity) {
            vehicle.fuelTankCapacity = Number(vehicle.vehicleModel.tankCapacity);
        }
    }

    // Fallback for Rates
    // basic check: if object is empty or rates are 0/null
    let rates = vehicle.fuelConsumptionRates as any;
    if (!rates || (Object.keys(rates).length === 0) || (!rates.summerRate && !rates.winterRate)) {
        if (vehicle.vehicleModel.summerRate || vehicle.vehicleModel.winterRate) {
            vehicle.fuelConsumptionRates = {
                summerRate: Number(vehicle.vehicleModel.summerRate || 0),
                winterRate: Number(vehicle.vehicleModel.winterRate || 0),
                cityIncreasePercent: rates?.cityIncreasePercent,
                warmingIncreasePercent: rates?.warmingIncreasePercent
            };
        }
    }
    return vehicle;
}

export async function createWaybill(userInfo: UserInfo, input: CreateWaybillInput) {
    const organizationId = userInfo.organizationId;
    console.log('[WB-1005] createWaybill service called');

    const date = new Date(input.date);
    if (Number.isNaN(date.getTime())) {
        throw new BadRequestError('Некорректная дата');
    }

    // PERIOD-LOCK-001: Check if period is locked
    const dateStr = input.date.substring(0, 10);
    if (await checkPeriodLock(organizationId, dateStr)) {
        throw new BadRequestError(`Период ${dateStr.substring(0, 7)} закрыт. Создание документов в этом периоде невозможно.`);
    }

    // WB-906: Driver restrictions
    let targetDriverId = input.driverId;
    if (userInfo.role === 'driver') {
        if (!userInfo.employeeId) {
            throw new BadRequestError('Конфигурация пользователя неполная (отсутствует связь с сотрудником)');
        }
        const driver = await prisma.driver.findUnique({
            where: { employeeId: userInfo.employeeId }
        });
        if (!driver) {
            throw new BadRequestError('Запись водителя не найдена');
        }
        targetDriverId = driver.id; // Force own driverId
    }

    // WB-402: Validate odometer - end >= start
    if (input.odometerStart !== undefined && input.odometerEnd !== undefined) {
        const odometerValidation = validateOdometer(input.odometerStart, input.odometerEnd);
        if (!odometerValidation.isValid) {
            throw new BadRequestError(odometerValidation.error!);
        }
    }

    // Verify vehicle and driver exist
    // Note: We don't filter by organizationId because:
    // 1. Vehicle/driver may be in a sub-organization
    // 2. Parent org should be able to create waybills for sub-org vehicles
    const vehicleData = await prisma.vehicle.findFirst({
        where: { id: input.vehicleId },
        // @ts-ignore: VehicleModel relation is new
        include: { vehicleModel: true }
    });
    if (!vehicleData) throw new BadRequestError('Транспортное средство не найдено');
    const vehicle = applyVehicleFallbacks(vehicleData);

    // REL-701: Strict Driver.id enforcement. No more fallback to employeeId.
    const driver = await prisma.driver.findFirst({
        where: { id: targetDriverId }
    });

    if (!driver) throw new BadRequestError('Водитель не найден (неверный ID водителя)');

    // Use the actual driver ID for waybill creation
    const actualDriverId = driver.id;

    // FUEL-CARD-AUTO-001: Auto-lookup driver's assigned fuel card
    let autoFuelCardId: string | null = null;
    const driverFuelCard = await prisma.fuelCard.findFirst({
        where: {
            organizationId,
            assignedToDriverId: actualDriverId,
            isActive: true
        },
        orderBy: { createdAt: 'desc' } // Use most recent if multiple
    });
    if (driverFuelCard) {
        autoFuelCardId = driverFuelCard.id;
        console.log(`[FUEL-CARD-AUTO] Auto-selected fuel card ${driverFuelCard.cardNumber} for driver ${actualDriverId}`);
    }
    // BLS-202: Reserve blank for this waybill
    let validatedBlankId: string | null = null;
    let waybillNumber = '';

    try {
        if (input.blankId) {
            const result = await reserveSpecificBlank(
                organizationId,
                input.blankId,
                actualDriverId,
                vehicle.departmentId ?? undefined
            );
            validatedBlankId = result.blank.id;
            waybillNumber = formatBlankNumber(result.blank.series, result.blank.number);
        } else {
            const result = await reserveNextBlankForDriver(
                organizationId,
                actualDriverId,
                vehicle.departmentId ?? undefined
            );
            validatedBlankId = result.blank.id;
            waybillNumber = formatBlankNumber(result.blank.series, result.blank.number);
        }
    } catch (err: any) {
        if (err.statusCode) throw err;
        throw new BadRequestError(err.message || 'Ошибка резервирования бланка');
    }

    // WB-1006: Method-specific validation
    const method = input.fuelCalculationMethod || 'BOILER';
    if (method === 'SEGMENTS' || method === 'MIXED') {
        if (!input.routes || input.routes.length === 0) {
            throw new BadRequestError('Маршруты обязательны для выбранного метода расчета', 'ROUTES_REQUIRED_FOR_METHOD');
        }
        if (input.routes.every(r => (r.distanceKm || 0) <= 0)) {
            throw new BadRequestError('Хотя бы один участок маршрута должен иметь пробег', 'INVALID_ROUTE_DISTANCE');
        }
    }
    if (method === 'BOILER' || method === 'MIXED') {
        if (input.odometerStart == null || input.odometerEnd == null) {
            throw new BadRequestError('Показания одометра обязательны для выбранного метода расчета', 'ODOMETER_REQUIRED_FOR_METHOD');
        }
    }

    // WB-1005: Calculate fuelPlanned based on method
    let calculatedFuelLines = input.fuelLines || [];
    const odometerDistanceKm = calculateDistanceKm(input.odometerStart, input.odometerEnd);

    if (vehicle.fuelConsumptionRates) {
        const seasonSettings = await getSeasonSettings();
        const isWinter = isWinterDate(input.date, seasonSettings);
        const rates = vehicle.fuelConsumptionRates as FuelConsumptionRates;
        const baseRate = isWinter
            ? (rates.winterRate ?? rates.summerRate ?? 0)
            : (rates.summerRate ?? rates.winterRate ?? 0);

        const calculationSegments: FuelSegment[] = (input.routes || []).map(r => ({
            distanceKm: r.distanceKm || 0,
            isCityDriving: r.isCityDriving || false,
            isWarming: r.isWarming || false
        }));

        const fuelPlanned = calculatePlannedFuelByMethod({
            method,
            baseRate,
            odometerDistanceKm,
            segments: calculationSegments,
            rates
        });

        if (calculatedFuelLines.length > 0) {
            calculatedFuelLines = calculatedFuelLines.map((fl, index) => ({
                ...fl,
                fuelPlanned: index === 0 ? fuelPlanned : undefined
            }));
        }
    }

    // Verify fuel input (WB-FIX-PL-001)
    let fuelLinesCreate = calculatedFuelLines.map(fl => ({
        stockItemId: fl.stockItemId,
        fuelStart: fl.fuelStart,
        fuelReceived: fl.fuelReceived,
        fuelConsumed: fl.fuelConsumed,
        fuelEnd: fl.fuelEnd,
        fuelPlanned: fl.fuelPlanned,
    }));

    if (input.fuel && (input.fuel.stockItemId || input.fuel.fuelStart || input.fuel.fuelReceived || input.fuel.fuelEnd || input.fuel.sourceType)) {
        if (!input.fuel.stockItemId) {
            // If we have some fuel data but no stock item - throw or ignore? 
            // Plan says "stockItemId required if fuel is not empty".
            // Use vehicle.fuelStockItemId as fallback if available
            if (!input.fuel.stockItemId) {
                if (vehicle.fuelStockItemId) {
                    input.fuel.stockItemId = vehicle.fuelStockItemId;
                    console.log(`[WB-1005] Auto-filled stockItemId from Vehicle: ${vehicle.fuelStockItemId}`);
                } else if (input.fuel.fuelStart || input.fuel.fuelReceived || input.fuel.fuelEnd) {
                    // Try legacy field (deprecated but might exist)
                    // @ts-ignore
                    if (vehicle.fuelTypeId || vehicle.fuelType) {
                        // We can't use fuelTypeId for stockItemId directly, so we still fail if no stockItem
                        throw new BadRequestError('Не указан тип топлива (stockItemId) и у ТС не задан тип по умолчанию', 'FUEL_TYPE_REQUIRED');
                    }
                    throw new BadRequestError('Не указан тип топлива (stockItemId)', 'FUEL_TYPE_REQUIRED');
                }
            }
        } else {
            // Add flattened fuel as a line if not already present in calculated (which usually comes from method calc)
            // But here we are creating fresh. 
            // If method=BOILER/MIXED, we might have calc lines. 
            // If method=DIRECT or user manual input, we prioritize input.fuel?
            // User plan B3: "upsert aggregate... if fuel is not empty -> create".
            // Since this is CREATE, we just add to create payload. NOTE: check logic for fallthrough

            // Overwrite or append? Usually flattened fuel is the MAIN fuel.
            // If calculatedFuelLines exists (from boiler), it might already have entries.
            // Let's assume input.fuel is the primary source of truth for the first tank.
            // If we successfully set stockItemId above, we proceed.

            const newFuelLine = {
                stockItemId: input.fuel.stockItemId,
                fuelStart: input.fuel.fuelStart ?? undefined,
                fuelReceived: input.fuel.fuelReceived ?? undefined,
                fuelConsumed: input.fuel.fuelConsumed ?? undefined,
                fuelEnd: input.fuel.fuelEnd ?? undefined,
                fuelPlanned: input.fuel.fuelPlanned ?? undefined,
                // B1/B3: extra fields
                refueledAt: input.fuel.refueledAt ? new Date(input.fuel.refueledAt) : undefined,
                sourceType: input.fuel.sourceType,
                comment: input.fuel.comment
            };

            // If we have calculated lines, we might need to merge or replace the first one?
            if (fuelLinesCreate.length > 0) {
                // Update the first line
                fuelLinesCreate[0] = { ...fuelLinesCreate[0], ...newFuelLine };
            } else {
                fuelLinesCreate.push(newFuelLine);
            }
        }
    }

    // Create waybill with fuelLines and routes
    const created = await prisma.waybill.create({
        data: {
            organizationId,
            departmentId: vehicle.departmentId,
            number: waybillNumber,
            date: date,
            vehicleId: input.vehicleId,
            driverId: actualDriverId,
            fuelCardId: autoFuelCardId, // FUEL-CARD-AUTO-001: Auto-assigned from driver's card
            blankId: validatedBlankId,
            odometerStart: input.odometerStart,
            odometerEnd: input.odometerEnd,
            isCityDriving: input.isCityDriving ?? false,
            isWarming: input.isWarming ?? false,
            fuelCalculationMethod: method as any,
            plannedRoute: input.plannedRoute,
            notes: input.notes,
            status: WaybillStatus.DRAFT,

            // WB-FIX-PL-001 Fields
            dispatcherEmployeeId: input.dispatcherEmployeeId
                ?? (input as any).dispatcherId
                ?? null,
            controllerEmployeeId: input.controllerEmployeeId
                ?? (input as any).controllerId
                ?? null,
            // REL-103: startAt = departure datetime, endAt = return datetime
            // DEBUG: Log startAt value
            ...(() => { console.log('[REL-103] Creating waybill with startAt:', input.startAt, 'endAt:', input.endAt, 'validTo:', input.validTo); return {}; })(),
            startAt: input.startAt ? new Date(input.startAt) : null,
            endAt: input.endAt ? new Date(input.endAt) : null,
            validTo: input.validTo ? new Date(input.validTo) : null,

            routes: input.routes && input.routes.length > 0 ? {
                // WB-FIX: Removed deleteMany - only valid in UPDATE, not CREATE
                create: input.routes.map(r => ({
                    legOrder: r.legOrder,
                    routeId: r.routeId || null,
                    fromPoint: r.fromPoint || null,
                    toPoint: r.toPoint || null,
                    distanceKm: r.distanceKm || 0,
                    isCityDriving: r.isCityDriving || false,
                    isWarming: r.isWarming || false,
                    isMountainDriving: r.isMountainDriving || false,  // COEF-MOUNTAIN-001
                    comment: r.comment || null,
                    date: r.date ? new Date(r.date) : null,  // WB-ROUTE-DATE: Support multi-day routes
                }))
            } : undefined,
            fuelLines: fuelLinesCreate.length > 0 ? {
                create: fuelLinesCreate
            } : undefined
        },
        include: {
            fuelLines: true,
            blank: true,
            routes: true,
            dispatcherEmployee: true,
            controllerEmployee: true
        }
    } as any);

    // WB-HOTFIX-UI-STATE-001: Flatten fuelLines to fuel (same as getWaybillById)
    const createdWithIncludes = created as any;
    let fuelAgg = null;
    if (createdWithIncludes.fuelLines && createdWithIncludes.fuelLines.length > 0) {
        const sorted = [...createdWithIncludes.fuelLines].sort((a: any, b: any) => {
            const timeA = a.refueledAt ? new Date(a.refueledAt).getTime() : 0;
            const timeB = b.refueledAt ? new Date(b.refueledAt).getTime() : 0;
            if (timeA !== timeB) return timeB - timeA;
            return b.id.localeCompare(a.id);
        });
        fuelAgg = sorted[0];
    }

    return {
        ...created,
        fuel: {
            stockItemId: fuelAgg?.stockItemId || null,
            fuelStart: fuelAgg?.fuelStart != null ? Number(fuelAgg.fuelStart) : null,
            fuelReceived: fuelAgg?.fuelReceived != null ? Number(fuelAgg.fuelReceived) : null,
            fuelConsumed: fuelAgg?.fuelConsumed != null ? Number(fuelAgg.fuelConsumed) : null,
            fuelEnd: fuelAgg?.fuelEnd != null ? Number(fuelAgg.fuelEnd) : null,
            fuelPlanned: fuelAgg?.fuelPlanned != null ? Number(fuelAgg.fuelPlanned) : null,
            refueledAt: fuelAgg?.refueledAt ? fuelAgg.refueledAt.toISOString?.() ?? fuelAgg.refueledAt : null,
            sourceType: fuelAgg?.sourceType || null,
            comment: fuelAgg?.comment || null,
        }
    };
}

export async function updateWaybill(userInfo: UserInfo, id: string, data: Partial<CreateWaybillInput>) {
    const organizationId = userInfo.organizationId;
    const where: any = { id, organizationId };

    if (userInfo.role === 'driver' && userInfo.employeeId) {
        const driver = await prisma.driver.findUnique({
            where: { employeeId: userInfo.employeeId }
        });
        if (driver) {
            where.driverId = driver.id;
        } else {
            throw new BadRequestError('Запись водителя не найдена');
        }
    }

    const waybill = await prisma.waybill.findFirst({
        where,
        // @ts-ignore: VehicleModel relation is new
        include: { vehicle: { include: { vehicleModel: true } }, fuelLines: true }
    }) as any;
    if (!waybill) throw new NotFoundError('Путевой лист не найден');

    if (waybill.status === WaybillStatus.POSTED) {
        throw new BadRequestError('Нельзя редактировать проведённый путевой лист');
    }

    // PERIOD-LOCK-001: Check if old period is locked
    const oldDateStr = waybill.date instanceof Date
        ? waybill.date.toISOString().substring(0, 10)
        : String(waybill.date).substring(0, 10);
    if (await checkPeriodLock(organizationId, oldDateStr)) {
        throw new BadRequestError(`Период ${oldDateStr.substring(0, 7)} закрыт. Редактирование документа невозможно.`);
    }

    // PERIOD-LOCK-001: Check if NEW date (if changed) is in locked period
    if (data.date && data.date !== oldDateStr) {
        const newDateStr = data.date.substring(0, 10);
        if (await checkPeriodLock(organizationId, newDateStr)) {
            throw new BadRequestError(`Нельзя переместить документ в закрытый период ${newDateStr.substring(0, 7)}.`);
        }
    }

    const newOdometerStart = data.odometerStart !== undefined ? data.odometerStart : (waybill.odometerStart ? Number(waybill.odometerStart) : null);
    const newOdometerEnd = data.odometerEnd !== undefined ? data.odometerEnd : (waybill.odometerEnd ? Number(waybill.odometerEnd) : null);

    if (newOdometerStart !== null && newOdometerEnd !== null) {
        const odometerValidation = validateOdometer(newOdometerStart, newOdometerEnd);
        if (!odometerValidation.isValid) {
            throw new BadRequestError(odometerValidation.error!);
        }
    }

    const method = data.fuelCalculationMethod || waybill.fuelCalculationMethod;
    const hasRoutes = (data.routes && data.routes.length > 0) || (await prisma.waybillRoute.count({ where: { waybillId: id } }) > 0);

    if (method === 'SEGMENTS' || method === 'MIXED') {
        if (!hasRoutes) {
            throw new BadRequestError('Маршруты обязательны для выбранного метода расчета', 'ROUTES_REQUIRED_FOR_METHOD');
        }
    }

    if (method === 'BOILER' || method === 'MIXED') {
        if (newOdometerStart == null || newOdometerEnd == null) {
            throw new BadRequestError('Показания одометра обязательны для выбранного метода расчета', 'ODOMETER_REQUIRED_FOR_METHOD');
        }
    }

    // Recalculate fuelPlanned
    let calculatedFuelLines = data.fuelLines || [];

    // WB-FIX-PL-001: Handle flattened fuel input in update (same as create)
    if (data.fuel && !data.fuelLines) {
        let targetStockItemId = data.fuel.stockItemId;

        // Fallback: if missing stockItemId, try to find it from vehicle
        if (!targetStockItemId) {
            let defaultStockItemId = null;
            if (data.vehicleId && data.vehicleId !== waybill.vehicleId) {
                const newVehicle = await prisma.vehicle.findUnique({ where: { id: data.vehicleId } });
                defaultStockItemId = newVehicle?.fuelStockItemId;
            } else {
                defaultStockItemId = waybill.vehicle.fuelStockItemId;
            }
            targetStockItemId = defaultStockItemId || null;
        }

        if (targetStockItemId) {
            const fl: FuelLineInput = {
                stockItemId: targetStockItemId,
                fuelStart: data.fuel.fuelStart ?? undefined,
                fuelReceived: data.fuel.fuelReceived ?? undefined,
                fuelConsumed: data.fuel.fuelConsumed ?? undefined,
                fuelEnd: data.fuel.fuelEnd ?? undefined,
                fuelPlanned: data.fuel.fuelPlanned ?? undefined,
            };
            calculatedFuelLines = [fl];
        }
    }

    // If vehicleId changed, fetch new vehicle with model
    const vehicleData = data.vehicleId
        ? await prisma.vehicle.findFirst({
            where: { id: data.vehicleId },
            // @ts-ignore: VehicleModel relation is new
            include: { vehicleModel: true }
        })
        : waybill.vehicle;

    // Apply defaults from model
    const vehicle = applyVehicleFallbacks(vehicleData);
    const waybillDate = data.date || waybill.date.toISOString().slice(0, 10);
    const odometerDistanceKm = calculateDistanceKm(newOdometerStart, newOdometerEnd);

    // FUEL-CARD-AUTO-001: Try to auto-select fuel card if currently null or driver changed
    let fuelCardId = waybill.fuelCardId;
    const driverIdChanged = data.driverId && data.driverId !== waybill.driverId;

    if (!fuelCardId || driverIdChanged) {
        const autoCardId = await findActiveCardForDriver(organizationId, data.driverId || waybill.driverId);
        if (autoCardId) {
            fuelCardId = autoCardId;
            console.log(`[FUEL-CARD-AUTO] Auto-selected card ${fuelCardId} for waybill ${id} during update`);
        }
    }

    if (vehicle?.fuelConsumptionRates) {
        const seasonSettings = await getSeasonSettings();
        const isWinter = isWinterDate(waybillDate, seasonSettings);
        const rates = vehicle.fuelConsumptionRates as FuelConsumptionRates;
        const baseRate = isWinter
            ? (rates.winterRate ?? rates.summerRate ?? 0)
            : (rates.summerRate ?? rates.winterRate ?? 0);

        let calculationSegments: FuelSegment[] = [];
        if (data.routes) {
            calculationSegments = data.routes.map(r => ({
                distanceKm: r.distanceKm || 0,
                isCityDriving: r.isCityDriving || false,
                isWarming: r.isWarming || false
            }));
        } else {
            const existingRoutes = await prisma.waybillRoute.findMany({
                where: { waybillId: id },
                orderBy: { legOrder: 'asc' }
            });
            calculationSegments = existingRoutes.map(r => ({
                distanceKm: Number(r.distanceKm) || 0,
                isCityDriving: r.isCityDriving || false,
                isWarming: r.isWarming || false
            }));
        }

        const fuelPlanned = calculatePlannedFuelByMethod({
            method,
            baseRate,
            odometerDistanceKm,
            segments: calculationSegments,
            rates
        });

        if (calculatedFuelLines && calculatedFuelLines.length > 0) {
            calculatedFuelLines = calculatedFuelLines.map((fl, index) => ({
                ...fl,
                fuelPlanned: index === 0 ? fuelPlanned : undefined
            }));
        } else if (waybill.fuelLines.length > 0) {
            await prisma.waybillFuel.update({
                where: { id: waybill.fuelLines[0].id },
                data: { fuelPlanned }
            });
        }
    }

    // FUEL-CARD-AUTO-001: If driver changed, update fuelCardId to new driver's card
    let newFuelCardId: string | null | undefined = undefined; // undefined = no change
    if (data.driverId && data.driverId !== waybill.driverId) {
        const driverFuelCard = await prisma.fuelCard.findFirst({
            where: {
                organizationId,
                assignedToDriverId: data.driverId,
                isActive: true
            },
            orderBy: { createdAt: 'desc' }
        });
        newFuelCardId = driverFuelCard?.id || null;
        console.log(`[FUEL-CARD-AUTO] Driver changed, new fuel card: ${newFuelCardId}`);
    }

    // Use transaction for consistency
    const txResult = await prisma.$transaction(async (tx) => {
        // Replace fuel lines if provided
        if (calculatedFuelLines !== undefined) {
            await tx.waybillFuel.deleteMany({ where: { waybillId: id } });
            if (calculatedFuelLines.length > 0) {
                await tx.waybillFuel.createMany({
                    data: calculatedFuelLines.map(fl => ({
                        waybillId: id,
                        stockItemId: fl.stockItemId,
                        fuelStart: fl.fuelStart,
                        fuelReceived: fl.fuelReceived,
                        fuelConsumed: fl.fuelConsumed,
                        fuelEnd: fl.fuelEnd,
                        fuelPlanned: fl.fuelPlanned,
                    }))
                });
            }
        }

        // Replace route segments if provided
        if (data.routes !== undefined) {
            await tx.waybillRoute.deleteMany({ where: { waybillId: id } });
            if (data.routes.length > 0) {
                await tx.waybillRoute.createMany({
                    data: data.routes.map(r => ({
                        waybillId: id,
                        legOrder: r.legOrder,
                        routeId: r.routeId || null,
                        fromPoint: r.fromPoint || null,
                        toPoint: r.toPoint || null,
                        distanceKm: r.distanceKm || 0,
                        isCityDriving: r.isCityDriving || false,
                        isWarming: r.isWarming || false,
                        isMountainDriving: r.isMountainDriving || false,  // COEF-MOUNTAIN-001
                        comment: r.comment || null,
                        date: r.date ? new Date(r.date) : null,  // WB-ROUTE-DATE: Support multi-day routes
                    }))
                });
            }
        }

        const updated = await tx.waybill.update({
            where: { id },
            data: {
                number: data.number,
                date: data.date ? new Date(data.date) : undefined,
                vehicleId: data.vehicleId,
                driverId: data.driverId,
                fuelCardId, // FUEL-CARD-AUTO-001: Auto-selected or existing
                blankId: data.blankId,
                odometerStart: data.odometerStart,
                odometerEnd: data.odometerEnd,
                isCityDriving: data.isCityDriving,
                isWarming: data.isWarming,
                fuelCalculationMethod: data.fuelCalculationMethod as any,
                plannedRoute: data.plannedRoute,
                notes: data.notes,

                // WB-FIX-PL-001: Persist new fields with normalization
                dispatcherEmployeeId: (data as any).dispatcherEmployeeId
                    ?? (data as any).dispatcherId
                    ?? undefined,
                controllerEmployeeId: (data as any).controllerEmployeeId
                    ?? (data as any).controllerId
                    ?? undefined,
                // REL-103: startAt = departure datetime, endAt = return datetime
                startAt: (data as any).startAt
                    ? new Date((data as any).startAt)
                    : undefined,
                endAt: (data as any).endAt
                    ? new Date((data as any).endAt)
                    : undefined,
                validTo: (data as any).validTo
                    ? new Date((data as any).validTo)
                    : undefined,
            },
            include: { fuelLines: true, routes: true }
        } as any);

        // WB-HOTFIX-UI-STATE-001: Flatten fuelLines to fuel (same as getWaybillById)
        const updatedWithIncludes = updated as any;
        let fuelAgg = null;
        if (updatedWithIncludes.fuelLines && updatedWithIncludes.fuelLines.length > 0) {
            const sorted = [...updatedWithIncludes.fuelLines].sort((a: any, b: any) => {
                const timeA = a.refueledAt ? new Date(a.refueledAt).getTime() : 0;
                const timeB = b.refueledAt ? new Date(b.refueledAt).getTime() : 0;
                if (timeA !== timeB) return timeB - timeA;
                return b.id.localeCompare(a.id);
            });
            fuelAgg = sorted[0];
        }

        return {
            waybillData: {
                ...updated,
                fuel: {
                    stockItemId: fuelAgg?.stockItemId || null,
                    fuelStart: fuelAgg?.fuelStart != null ? Number(fuelAgg.fuelStart) : null,
                    fuelReceived: fuelAgg?.fuelReceived != null ? Number(fuelAgg.fuelReceived) : null,
                    fuelConsumed: fuelAgg?.fuelConsumed != null ? Number(fuelAgg.fuelConsumed) : null,
                    fuelEnd: fuelAgg?.fuelEnd != null ? Number(fuelAgg.fuelEnd) : null,
                    fuelPlanned: fuelAgg?.fuelPlanned != null ? Number(fuelAgg.fuelPlanned) : null,
                    refueledAt: fuelAgg?.refueledAt ? fuelAgg.refueledAt.toISOString?.() ?? fuelAgg.refueledAt : null,
                    sourceType: fuelAgg?.sourceType || null,
                    comment: fuelAgg?.comment || null,
                }
            },
            fuelAgg,
            updatedDate: updated.date
        };
    });

    // WB-CASCADE-001: Cascade recalculation for DRAFT waybills
    let cascadeResult = { updatedCount: 0, waybillIds: [] as string[] };

    if (waybill.status === WaybillStatus.DRAFT) {
        const finalOdometerEnd = Number(txResult.waybillData.odometerEnd || 0);
        const finalFuelEnd = txResult.fuelAgg?.fuelEnd != null
            ? Number(txResult.fuelAgg.fuelEnd)
            : 0;

        cascadeResult = await recalculateDraftChain(
            organizationId,
            waybill.vehicleId,
            txResult.updatedDate,
            finalOdometerEnd,
            finalFuelEnd,
            id
        );
    }

    return {
        ...txResult.waybillData,
        cascadeUpdated: cascadeResult.updatedCount
    };
}


// WB-CASCADE-001: Cascade recalculation of subsequent DRAFT waybills
export async function recalculateDraftChain(
    organizationId: string,
    vehicleId: string,
    afterDate: Date,
    previousOdometerEnd: number,
    previousFuelEnd: number,
    excludeWaybillId?: string
): Promise<{ updatedCount: number; waybillIds: string[] }> {
    // Get vehicle for fuel consumption rates
    const vehicleData = await prisma.vehicle.findUnique({
        where: { id: vehicleId },
        // @ts-ignore: VehicleModel relation is new
        include: { vehicleModel: true }
    });
    const vehicle = applyVehicleFallbacks(vehicleData);

    if (!vehicle) {
        console.log('[WB-CASCADE] Vehicle not found, skipping cascade');
        return { updatedCount: 0, waybillIds: [] };
    }

    // Find all DRAFT waybills for this vehicle after the given date
    const subsequentDrafts = await prisma.waybill.findMany({
        where: {
            organizationId,
            vehicleId,
            status: WaybillStatus.DRAFT,
            date: { gt: afterDate },
            ...(excludeWaybillId && { id: { not: excludeWaybillId } })
        },
        orderBy: [
            { date: 'asc' },
            { createdAt: 'asc' }
        ],
        include: {
            fuelLines: true,
            routes: true
        }
    });

    if (subsequentDrafts.length === 0) {
        console.log('[WB-CASCADE] No subsequent drafts to update');
        return { updatedCount: 0, waybillIds: [] };
    }

    console.log(`[WB-CASCADE] Found ${subsequentDrafts.length} subsequent DRAFT waybills to recalculate`);

    // Get season settings once
    const seasonSettings = await getSeasonSettings();

    const updatedIds: string[] = [];
    let currentOdometerEnd = previousOdometerEnd;
    // WB-ROUNDING-FIX: Ensure initial fuel is clean
    let currentFuelEnd = Math.round(previousFuelEnd * 100) / 100;

    for (const draft of subsequentDrafts) {
        const oldOdometerStart = Number(draft.odometerStart || 0);
        const draftOdometerEnd = Number(draft.odometerEnd || 0);
        const oldFuelStart = draft.fuelLines[0]?.fuelStart ? Number(draft.fuelLines[0].fuelStart) : 0;

        // Calculate new values
        const newOdometerStart = currentOdometerEnd;
        const newFuelStart = currentFuelEnd;

        // Calculate distance for this draft
        const draftDistance = draftOdometerEnd > newOdometerStart
            ? draftOdometerEnd - newOdometerStart
            : 0;

        // Calculate fuelConsumed based on consumption rate
        let fuelConsumed = 0;
        if (vehicle.fuelConsumptionRates && draftDistance > 0) {
            const isWinter = isWinterDate(draft.date.toISOString(), seasonSettings);
            const rates = vehicle.fuelConsumptionRates as FuelConsumptionRates;
            const baseRate = isWinter
                ? (rates.winterRate ?? rates.summerRate ?? 0)
                : (rates.summerRate ?? rates.winterRate ?? 0);

            // Check for city driving modifier
            let cityModifier = 1;
            if (draft.isCityDriving && rates.cityIncreasePercent) {
                cityModifier = 1 + (rates.cityIncreasePercent / 100);
            }

            // Calculate consumption: distance * rate / 100 * modifiers
            const rawConsumed = (draftDistance * baseRate / 100) * cityModifier;
            // WB-ROUNDING-FIX: Round consumption
            fuelConsumed = Math.round(rawConsumed * 100) / 100;
        } else {
            // Fallback: use existing fuelConsumed or calculate from old values
            const existingConsumed = draft.fuelLines[0]?.fuelConsumed
                ? Number(draft.fuelLines[0].fuelConsumed)
                : 0;
            fuelConsumed = existingConsumed > 0 ? existingConsumed : 0;
        }

        // Get fuelReceived (refueling)
        const fuelReceived = draft.fuelLines[0]?.fuelReceived
            ? Number(draft.fuelLines[0].fuelReceived)
            : 0;

        // Calculate fuelEnd
        // WB-ROUNDING-FIX: Round result
        const newFuelEnd = Math.round((newFuelStart + fuelReceived - fuelConsumed) * 100) / 100;

        // Check if update is needed
        if (oldOdometerStart !== newOdometerStart ||
            oldFuelStart !== newFuelStart ||
            (draft.fuelLines[0] && Number(draft.fuelLines[0].fuelEnd || 0) !== newFuelEnd)) {

            // Update waybill odometerStart
            await prisma.waybill.update({
                where: { id: draft.id },
                data: { odometerStart: newOdometerStart }
            });

            // Update fuel line (if exists)
            if (draft.fuelLines.length > 0) {
                await prisma.waybillFuel.update({
                    where: { id: draft.fuelLines[0].id },
                    data: {
                        fuelStart: newFuelStart,
                        fuelConsumed: fuelConsumed,
                        fuelEnd: newFuelEnd
                    }
                });
            }

            updatedIds.push(draft.id);
            console.log(`[WB-CASCADE] Updated draft ${draft.number}: ` +
                `odometer ${oldOdometerStart} → ${newOdometerStart}, ` +
                `fuel ${oldFuelStart.toFixed(2)} → ${newFuelStart.toFixed(2)}, ` +
                `consumed ${fuelConsumed.toFixed(2)}, end ${newFuelEnd.toFixed(2)}`);
        }

        // Propagate to next iteration
        currentOdometerEnd = draftOdometerEnd;
        currentFuelEnd = newFuelEnd;
    }

    console.log(`[WB-CASCADE] Completed. Updated ${updatedIds.length} drafts: ${updatedIds.join(', ')}`);
    return { updatedCount: updatedIds.length, waybillIds: updatedIds };
}


export async function deleteWaybill(userInfo: UserInfo, id: string, blankAction: 'return' | 'spoil' = 'return') {

    const organizationId = userInfo.organizationId;
    // WB-906: Restriction for driver role
    const where: any = { id, organizationId };
    if (userInfo.role === 'driver' && userInfo.employeeId) {
        const driver = await prisma.driver.findUnique({
            where: { employeeId: userInfo.employeeId }
        });
        if (driver) {
            where.driverId = driver.id;
        } else {
            throw new BadRequestError('Запись водителя не найдена');
        }
    }

    const waybill = await prisma.waybill.findFirst({
        where,
        include: { blank: true }
    });
    if (!waybill) throw new NotFoundError('Путевой лист не найден');

    // DOC-IMMUTABLE-020: Block deletion of POSTED waybills unconditionally
    if (waybill.status === WaybillStatus.POSTED) {
        throw new BadRequestError(
            'Нельзя удалить проведённый путевой лист. Используйте отмену проводки (скорректировать).',
            'DELETE_POSTED_FORBIDDEN'
        );
    }

    // BLK-DEL-ACTION-001: Handle blank based on user choice
    console.log('[WB-DEL-001] Deleting waybill:', waybill.id, 'blankId:', waybill.blankId, 'blank status:', waybill.blank?.status, 'blankAction:', blankAction);

    if (waybill.blankId && waybill.blank) {
        const blankStatus = waybill.blank.status;

        // Only process blanks in RESERVED or USED status
        if (blankStatus === BlankStatus.RESERVED || blankStatus === BlankStatus.USED) {
            if (blankAction === 'spoil') {
                // BLK-DEL-ACTION-001: Spoil blank
                try {
                    await spoilBlank(organizationId, waybill.blankId, {
                        reason: 'other',
                        note: `Списан при удалении ПЛ №${waybill.number}`,
                        userId: userInfo.id
                    });
                    console.log('[WB-DEL-001] ✅ Spoiled blank:', waybill.blankId);
                } catch (err) {
                    console.error('[WB-DEL-001] ❌ Failed to spoil blank:', err);
                    // Force update as fallback
                    await prisma.blank.update({
                        where: { id: waybill.blankId },
                        data: {
                            status: BlankStatus.SPOILED,
                            damagedReason: `Списан при удалении ПЛ №${waybill.number}`
                        }
                    });
                    console.log('[WB-DEL-001] ✅ Force-spoiled blank via fallback:', waybill.blankId);
                }
            } else {
                // Default: return blank to driver (ISSUED status)
                try {
                    await releaseBlank(organizationId, waybill.blankId);
                    console.log('[WB-DEL-001] ✅ Released blank back to ISSUED:', waybill.blankId);
                } catch (err) {
                    console.error('[WB-DEL-001] ❌ Failed to release blank:', err);
                    // Force update as fallback
                    await prisma.blank.update({
                        where: { id: waybill.blankId },
                        data: { status: BlankStatus.ISSUED }
                    });
                    console.log('[WB-DEL-001] ✅ Force-released blank via fallback:', waybill.blankId);
                }
            }
        } else {
            console.log('[WB-DEL-001] Blank not in RESERVED/USED status, current:', blankStatus);
        }
    }

    // DOC-IMMUTABLE-020: Stock movement cleanup removed - POSTED waybills can never reach here

    return prisma.waybill.delete({ where: { id } });
}

export async function bulkDeleteWaybills(userInfo: UserInfo, ids: string[], blankAction: 'return' | 'spoil' = 'return') {
    console.log(`[WB-DEL-BULK] Deleting ${ids.length} waybills for user ${userInfo.id}, blankAction: ${blankAction}`);
    const results = {
        success: [] as string[],
        errors: [] as { id: string; error: string }[]
    };

    for (const id of ids) {
        try {
            await deleteWaybill(userInfo, id, blankAction);
            results.success.push(id);
        } catch (err: any) {
            console.error(`[WB-DEL-BULK] Failed to delete waybill ${id}:`, err);
            results.errors.push({ id, error: err.message || 'Unknown error' });
        }
    }

    return results;
}

/**
 * WB-BULK-POST: Bulk change waybill status (posting/reverting)
 * Based on Innovations prototype pattern: batch load, in-memory processing, bulk write
 * WB-BULK-SEQ: Added stopOnFirstError to preserve odometer/fuel chain continuity
 */
export async function bulkChangeWaybillStatus(
    userInfo: UserInfo,
    ids: string[],
    status: WaybillStatus,
    userId: string,
    reason?: string,
    stopOnFirstError: boolean = true  // WB-BULK-SEQ: Stop on first error by default for posting
): Promise<{ success: number; failed: { id: string; number: string; error: string }[]; stoppedDueToError?: boolean; skippedIds?: string[] }> {
    console.log(`[WB-BULK-STATUS] Processing ${ids.length} waybills to status ${status}, stopOnFirstError=${stopOnFirstError}`);

    const results: {
        success: number;
        failed: { id: string; number: string; error: string }[];
        stoppedDueToError?: boolean;
        skippedIds?: string[];
    } = {
        success: 0,
        failed: []
    };

    if (ids.length === 0) return results;

    // 1. Batch load all waybills
    const waybills = await prisma.waybill.findMany({
        where: {
            id: { in: ids },
            organizationId: userInfo.organizationId
        },
        include: {
            fuelLines: true,
            blank: true
        }
    });

    // WB-BULK-ORDER-FIX: Sort order depends on target status
    // - POSTED: chronological (oldest first) - so chain builds correctly
    // - DRAFT (cancel): reverse chronological (newest first) - so final rollback = earliest values
    if (status === WaybillStatus.DRAFT) {
        waybills.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else {
        waybills.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }

    // WB-BULK-SEQ: Track if we should stop processing
    let shouldStop = false;
    const skippedIds: string[] = [];

    // 2. Process each waybill
    for (const waybill of waybills) {
        // WB-BULK-SEQ: If we hit an error and stopOnFirstError is enabled, skip remaining
        if (shouldStop) {
            skippedIds.push(waybill.id);
            console.log(`[WB-BULK-STATUS] ⏭️ Skipping ${waybill.number} due to previous error`);
            continue;
        }

        try {
            // Skip if already in target status
            if (waybill.status === status) {
                console.log(`[WB-BULK-STATUS] Skipping ${waybill.number} - already ${status}`);
                continue;
            }

            // Validate: can only post DRAFT or SUBMITTED waybills
            // (DRAFT → POSTED for Local mode, SUBMITTED → POSTED for Central mode)
            if (status === WaybillStatus.POSTED &&
                waybill.status !== WaybillStatus.DRAFT &&
                waybill.status !== WaybillStatus.SUBMITTED) {
                results.failed.push({
                    id: waybill.id,
                    number: waybill.number,
                    error: `Можно провести только черновик или отправленный на проверку (текущий статус: ${waybill.status})`
                });
                // WB-BULK-SEQ: Stop if posting and stopOnFirstError enabled
                if (stopOnFirstError && status === WaybillStatus.POSTED) {
                    shouldStop = true;
                    results.stoppedDueToError = true;
                    console.log(`[WB-BULK-STATUS] ⛔ Stopping due to validation error in ${waybill.number}`);
                }
                continue;
            }

            // Validate: can only revert POSTED or SUBMITTED waybills to DRAFT
            // (POSTED → DRAFT for correction, SUBMITTED → DRAFT for return to revision)
            if (status === WaybillStatus.DRAFT &&
                waybill.status !== WaybillStatus.POSTED &&
                waybill.status !== WaybillStatus.SUBMITTED) {
                results.failed.push({
                    id: waybill.id,
                    number: waybill.number,
                    error: `Можно вернуть в черновик только проведенный или отправленный ПЛ (текущий статус: ${waybill.status})`
                });
                continue;
            }

            // Use existing changeWaybillStatus which handles all the logic
            // (blanks, fuel, stock movements, cascade recalc, etc.)
            await changeWaybillStatus(
                userInfo,
                waybill.id,
                status,
                userId,
                false, // hasOverridePermission
                reason
            );

            results.success++;
            console.log(`[WB-BULK-STATUS] ✅ ${waybill.number} → ${status}`);

        } catch (err: any) {
            console.error(`[WB-BULK-STATUS] ❌ ${waybill.number}:`, err.message);
            results.failed.push({
                id: waybill.id,
                number: waybill.number,
                error: err.message || 'Unknown error'
            });

            // WB-BULK-SEQ: Stop processing on first error if enabled and posting
            if (stopOnFirstError && status === WaybillStatus.POSTED) {
                shouldStop = true;
                results.stoppedDueToError = true;
                console.log(`[WB-BULK-STATUS] ⛔ Stopping due to error in ${waybill.number}`);
            }
        }
    }

    // WB-BULK-SEQ: Add skipped IDs to result if any
    if (skippedIds.length > 0) {
        results.skippedIds = skippedIds;
    }

    console.log(`[WB-BULK-STATUS] Completed: ${results.success} success, ${results.failed.length} failed, ${skippedIds.length} skipped`);
    return results;
}

export async function changeWaybillStatus(
    userInfo: UserInfo,
    id: string,
    status: WaybillStatus,
    userId: string,
    hasOverridePermission: boolean = false, // WB-701: Permission to override norm excess
    reason?: string
) {
    const organizationId = userInfo.organizationId;
    // WB-906: Restriction for driver role
    const where: any = { id, organizationId };
    if (userInfo.role === 'driver' && userInfo.employeeId) {
        const driver = await prisma.driver.findUnique({
            where: { employeeId: userInfo.employeeId }
        });
        if (driver) {
            where.driverId = driver.id;
        } else {
            throw new BadRequestError('Запись водителя не найдена');
        }
    }

    const waybill = await prisma.waybill.findFirst({
        where,
        include: {
            fuelLines: {
                include: {
                    stockItem: true,
                },
            },
            blank: true,
            department: true, // WH-DEC-001: Need defaultWarehouseId for stock movements
        },
    });

    if (!waybill) throw new NotFoundError('Путевой лист не найден');

    // PERIOD-LOCK-001: Check if period is locked before status change
    const waybillDateStr = waybill.date instanceof Date
        ? waybill.date.toISOString().substring(0, 10)
        : String(waybill.date).substring(0, 10);
    if (await checkPeriodLock(organizationId, waybillDateStr)) {
        throw new BadRequestError(`Период ${waybillDateStr.substring(0, 7)} закрыт. Изменение статуса документа невозможно.`);
    }

    // State machine validation (aligned with schema.prisma)
    // WB-BULK-POST: Added DRAFT → POSTED for bulk posting
    const allowedTransitions: Record<WaybillStatus, WaybillStatus[]> = {
        [WaybillStatus.DRAFT]: [WaybillStatus.SUBMITTED, WaybillStatus.POSTED, WaybillStatus.CANCELLED],
        [WaybillStatus.SUBMITTED]: [WaybillStatus.POSTED, WaybillStatus.CANCELLED, WaybillStatus.DRAFT], // UX: Allow return for rework
        [WaybillStatus.POSTED]: [WaybillStatus.DRAFT], // UX: Allow correction (return to draft)
        [WaybillStatus.CANCELLED]: [], // final state
    };

    const currentStatus = waybill.status;
    const allowed = allowedTransitions[currentStatus];

    if (!allowed.includes(status)) {
        throw new BadRequestError(
            `Переход из статуса ${currentStatus} в ${status} недопустим`
        );
    }

    // WB-701: Check for norm excess before POSTED (lines 621-647 omitted for brevity, keeping them)
    // ... (code above is preserved in context matching, we insert new block below)

    // WB-POST-010: Conflict Validation (Drafts vs Posted)
    if (status === WaybillStatus.POSTED) {
        // 1. Get the LAST POSTED Waybill for this vehicle (excluding current one)
        const lastPosted = await prisma.waybill.findFirst({
            where: {
                organizationId,
                vehicleId: waybill.vehicleId,
                status: WaybillStatus.POSTED,
                id: { not: id }, // Exclude current if it was already posted (though transition check prevents re-post usually)
                // We want strict chronological order: last posted date <= current date
                // But user might be posting a "forgotten" waybill from the past?
                // Rule: "The new waybill must effectively be 'after' the previous posted one in sequence"
                // OR "If we insert a waybill in the past, does it conflict with FUTURE posted waybills?"
                // The requirement says: "waybill.odometerStart not outdated relative to last POSTED".
                // This implies we checking against the LATEST known state.
            },
            orderBy: [
                { date: 'desc' },
                { odometerEnd: 'desc' }
            ]
        });

        if (lastPosted) {
            // Validation 1: Odometer Continuity
            // new.odometerStart >= last.odometerEnd
            const newStart = Number(waybill.odometerStart || 0);
            const lastEnd = Number(lastPosted.odometerEnd || 0);

            if (newStart < lastEnd) {
                throw new BadRequestError(
                    `Конфликт показаний одометра: текущее начало (${newStart}) меньше предыдущего конца (${lastEnd}, ПЛ №${lastPosted.number})`,
                    'ODOMETER_CONFLICT'
                );
            }

            // Validation 2: Temporal Sequence (Optional but recommended)
            // new.date >= last.date (approximately)
            // If new waybill is strictly BEFORE last posted waybill, it might be an issue depending on policy.
            // Requirement usually allows posting backdated waybills IF odometer fits?
            // "fuelAtStart aligned with tankBalanceAsOf(startAt)" -> This is handled by prefill mostly.
            // But if user forces POST, we check if they break the chain.
            // Let's enforce Strict Odometer only for now as requested.
            // "waybill.odometerStart не устарел относительно последнего POSTED" -> Covered.

            // Allow backdating if odometer is correct? (e.g. gaps).
            // If odometer is correct, let it pass.
        }

        // WB-CHAIN-INTEGRITY-001: Check for unposted waybills with earlier dates
        // This prevents posting waybills out of order, which would create gaps in the chain
        const unpostedEarlier = await prisma.waybill.findMany({
            where: {
                organizationId,
                vehicleId: waybill.vehicleId,
                status: { in: [WaybillStatus.DRAFT, WaybillStatus.SUBMITTED] },
                id: { not: id },
                date: { lt: waybill.date }  // Earlier date than current waybill
            },
            orderBy: { date: 'asc' },
            select: { id: true, number: true, date: true, status: true }
        });

        if (unpostedEarlier.length > 0) {
            const unpostedNumbers = unpostedEarlier.map(w => {
                const dateStr = w.date instanceof Date
                    ? w.date.toLocaleDateString('ru-RU')
                    : new Date(w.date).toLocaleDateString('ru-RU');
                return `№${w.number} (${dateStr})`;
            }).join(', ');

            throw new BadRequestError(
                `Невозможно провести ПЛ. Сначала проведите или удалите более ранние ПЛ: ${unpostedNumbers}`,
                'CHAIN_INTEGRITY_ERROR'
            );
        }

        // Validation 3: Future Conflicts (if inserting in the middle)
        // Check if there is a POSTED waybill *after* this one with odometerStart < this.odometerEnd
        const nextPosted = await prisma.waybill.findFirst({
            where: {
                organizationId,
                vehicleId: waybill.vehicleId,
                status: WaybillStatus.POSTED,
                id: { not: id },
                odometerStart: { lt: Number(waybill.odometerEnd || 0) },
                date: { gte: waybill.date } // Look for future waybills
            }
        });

        // This is complex. Stick to "Last Posted" check as requested.
    }

    // WB-701: Check for norm excess before POSTED
    const normExcessPercent = 0.10; // 10% allowed excess
    let normExcessLines: { stockItemId: string; consumed: number; planned: number; excessPercent: number }[] = [];

    if (status === WaybillStatus.POSTED) {
        for (const fuelLine of waybill.fuelLines) {
            const consumed = Number(fuelLine.fuelConsumed) || 0;
            const planned = Number(fuelLine.fuelPlanned) || 0;

            if (consumed > 0 && planned > 0 && consumed > planned * (1 + normExcessPercent)) {
                const excessPercent = ((consumed / planned) - 1) * 100;
                normExcessLines.push({
                    stockItemId: fuelLine.stockItemId,
                    consumed,
                    planned,
                    excessPercent: Math.round(excessPercent * 100) / 100
                });
            }
        }

        if (normExcessLines.length > 0 && !hasOverridePermission) {
            console.warn('[WB-701] Norm excess detected without permission:', normExcessLines);
            throw new BadRequestError(
                `Превышение нормы расхода: факт превышает план более чем на ${normExcessPercent * 100}%. ` +
                `Требуется право waybill.overrideNorm`
            );
        }
    }

    // WB-501: Wrap all operations in atomic transaction
    return prisma.$transaction(async (tx) => {
        // FUEL-CARD-AUTO-001: Final attempt to find an active fuel card before posting if still null
        let effectiveFuelCardId = waybill.fuelCardId;
        if (!effectiveFuelCardId && status === WaybillStatus.POSTED) {
            const autoCardId = await findActiveCardForDriver(organizationId, waybill.driverId);
            if (autoCardId) {
                effectiveFuelCardId = autoCardId;
                await tx.waybill.update({
                    where: { id },
                    data: { fuelCardId: autoCardId }
                });
                console.log(`[FUEL-CARD-AUTO] Final auto-assignment of card ${autoCardId} to waybill ${waybill.id} before posting`);
            }
        }

        // WB-701: Log norm excess if allowed with permission
        if (normExcessLines.length > 0 && hasOverridePermission) {
            await tx.auditLog.create({
                data: {
                    organizationId,
                    userId,
                    actionType: 'STATUS_CHANGE', // WB-701: Logging norm override within status change
                    entityType: 'WAYBILL',
                    entityId: id,
                    description: `Превышение нормы расхода топлива в ПЛ №${waybill.number}`,
                    oldValue: { fuelLines: normExcessLines.map(l => ({ planned: l.planned })) },
                    newValue: { fuelLines: normExcessLines.map(l => ({ consumed: l.consumed, excessPercent: l.excessPercent })) },
                },
            });
            console.log('[WB-701] Norm override logged to audit');
        }

        // POSTING-SVC-010: Delegate posting logic to PostingService
        if (status === WaybillStatus.POSTED) {
            await postWaybill(tx, waybill as any, effectiveFuelCardId, userId);
        }

        // Обновляем статус ПЛ
        const updated = await tx.waybill.update({
            where: { id },
            data: {
                status,
                ...(status === WaybillStatus.POSTED && { completedByUserId: userId }),
                ...(status === WaybillStatus.SUBMITTED && { approvedByUserId: userId }),
                // REL-304: Reason stored in audit log, not in waybill table (reviewerComment field doesn't exist)
            },
        });

        // POSTING-SVC-010: Delegate cancel logic to PostingService
        if (currentStatus === WaybillStatus.POSTED && status === WaybillStatus.DRAFT) {
            await cancelWaybill(tx, waybill as any, reason || 'Корректировка ПЛ', userId);
        }

        // Логируем в audit
        await tx.auditLog.create({
            data: {
                organizationId,
                userId,
                actionType: 'STATUS_CHANGE',
                entityType: 'WAYBILL',
                entityId: id,
                description: `Изменен статус ПЛ №${waybill.number} с ${currentStatus} на ${status}`,
                oldValue: { status: currentStatus },
                newValue: { status },
            },
        });

        console.log('[WB-501] Status change completed atomically:', { id, from: currentStatus, to: status });
        return updated;
    });
}

// WB-PREFILL-020: Prefill Data Logic
export interface PrefillData {
    driverId: string | null;
    dispatcherEmployeeId: string | null;
    controllerEmployeeId: string | null;
    odometerStart: number | null;
    fuelStart: number | null;
    fuelStockItemId: string | null;
    tankBalance: number | null;
    lastWaybillId: string | null;
    lastWaybillNumber: string | null;
    lastWaybillDate: Date | null;
}

export async function getWaybillPrefillData(
    userInfo: UserInfo,
    vehicleId: string,
    date?: Date
): Promise<PrefillData> {
    const organizationId = userInfo.organizationId;

    // 1. Get Vehicle with Department Defaults
    // Note: We don't filter by organizationId to support sub-org vehicles
    const vehicle = await prisma.vehicle.findFirst({
        where: { id: vehicleId },
        include: {
            department: {
                include: {
                    defaultDispatcher: true,
                    defaultController: true
                }
            },
            fuelStockItem: true,
            assignedDriver: { // Assigned Driver (Employee)
                select: {
                    id: true,
                    dispatcherId: true,
                    controllerId: true,
                    driver: {
                        select: { id: true }
                    },
                    department: {
                        select: {
                            id: true,
                            defaultDispatcherEmployeeId: true,
                            defaultControllerEmployeeId: true
                        }
                    }
                }
            }
        }
    });

    if (!vehicle) {
        throw new NotFoundError('Транспортное средство не найдено');
    }

    // 2. Get Last Waybill (any status except CANCELLED)
    // Ordered by date desc, then created desc
    const lastWaybill = await prisma.waybill.findFirst({
        where: {
            organizationId,
            vehicleId,
            status: { not: WaybillStatus.CANCELLED },
            date: date ? { lte: date } : undefined // Include waybills up to and including the requested date
        },
        orderBy: [
            { date: 'desc' },
            { createdAt: 'desc' }
        ],
        include: {
            fuelLines: true // Needed to get fuelEnd
        }
    });

    // 3. Get Tank Balance (if fuelStockItem is set)
    let tankBalance: number | null = null;
    if (vehicle.fuelStockItemId) {
        try {
            const tankLocation = await getOrCreateVehicleTankLocation(vehicle.id);
            const balanceRaw = await getBalanceAt(
                tankLocation.id,
                vehicle.fuelStockItemId,
                date || new Date()
            );
            // handle balance return type (assuming { quantity: number } or number)
            tankBalance = typeof balanceRaw === 'number' ? balanceRaw : (balanceRaw as any)?.quantity || 0;
        } catch (e) {
            console.warn('[Prefill] Failed to get tank balance', e);
        }
    }

    // 4. Resolve IDs
    // Driver: Last Waybill Driver -> Vehicle Assigned Driver (resolved to Driver ID)
    let driverId = lastWaybill?.driverId || null;
    if (!driverId && vehicle.assignedDriver?.driver) {
        driverId = vehicle.assignedDriver.driver.id;
    }

    // Dispatcher/Controller: 
    // Priority:
    // 1. Personal Assigned (Employee.dispatcherId)
    // 2. Driver's Department Defaults
    // 3. Vehicle's Department Defaults

    // Check personal settings first
    let dispatcherId = vehicle.assignedDriver?.dispatcherId || null;
    let controllerId = vehicle.assignedDriver?.controllerId || null;

    // Fallback to Driver's Department
    if (!dispatcherId && vehicle.assignedDriver?.department) {
        dispatcherId = vehicle.assignedDriver.department.defaultDispatcherEmployeeId || null;
    }
    if (!controllerId && vehicle.assignedDriver?.department) {
        controllerId = vehicle.assignedDriver.department.defaultControllerEmployeeId || null;
    }

    // Fallback to Vehicle's Department
    if (!dispatcherId && vehicle.department) {
        dispatcherId = vehicle.department.defaultDispatcherEmployeeId || null;
    }
    if (!controllerId && vehicle.department) {
        controllerId = vehicle.department.defaultControllerEmployeeId || null;
    }

    // Lastly, default to null. Frontend can fill if user manually selects.

    // Odometer: Last Waybill End -> Vehicle Mileage -> 0
    let odometerStart = lastWaybill?.odometerEnd ? Number(lastWaybill.odometerEnd) : Number(vehicle.mileage);

    // P0-C: Fuel Start Priority:
    // 1. Last POSTED Waybill fuelEnd (most accurate)
    // 2. If no POSTED waybill, use Vehicle Card currentFuel
    // 3. Tank Balance only as last resort (may be stale)
    let fuelStart: number | null = null;

    if (lastWaybill) {
        // Priority 1: Use fuelEnd from last POSTED waybill
        const lastFuelLine = vehicle.fuelStockItemId
            ? lastWaybill.fuelLines.find(fl => fl.stockItemId === vehicle.fuelStockItemId)
            : lastWaybill.fuelLines[0];
        const lastFuelEnd = lastFuelLine?.fuelEnd;

        if (lastFuelEnd != null) {
            fuelStart = Number(lastFuelEnd);
        } else if (tankBalance != null) {
            fuelStart = tankBalance;
        } else {
            fuelStart = Number(vehicle.currentFuel);
        }
    } else {
        // No POSTED waybills - use Vehicle Card currentFuel (Initial Balance)
        fuelStart = Number(vehicle.currentFuel);
    }

    return {
        driverId,
        // dispatcherEmployeeId and controllerEmployeeId moved to end for normalization
        odometerStart,
        fuelStart,
        fuelStockItemId: vehicle.fuelStockItemId,
        tankBalance,
        lastWaybillId: lastWaybill?.id || null,
        lastWaybillNumber: lastWaybill?.number || null,
        lastWaybillDate: lastWaybill?.date || null,
        // Normalized naming for frontend compatibility
        dispatcherEmployeeId: dispatcherId,
        controllerEmployeeId: controllerId,
    };
}

