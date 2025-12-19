import { PrismaClient, WaybillStatus, BlankStatus } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { validateOdometer, calculateDistanceKm, calculatePlannedFuelByMethod, FuelConsumptionRates, FuelCalculationMethod, FuelSegment } from '../domain/waybill/fuel';
import { isWinterDate } from '../utils/dateUtils';
import { getSeasonSettings } from './settingsService';
import { reserveNextBlankForDriver, reserveSpecificBlank, releaseBlank } from './blankService';

const prisma = new PrismaClient();

export interface UserInfo {
    id: string;
    organizationId: string;
    departmentId: string | null;
    role: string;
    employeeId: string | null;
}

interface CreateWaybillInput {
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
    notes?: string;
    fuelCalculationMethod?: FuelCalculationMethod;
    routes?: Array<{
        legOrder: number;
        routeId?: string | null;
        fromPoint?: string;
        toPoint?: string;
        distanceKm?: number;
        isCityDriving?: boolean;
        isWarming?: boolean;
        comment?: string;
    }>;
    fuelLines?: Array<{
        stockItemId: string;
        fuelStart?: number;
        fuelReceived?: number;
        fuelConsumed?: number;
        fuelEnd?: number;
        fuelPlanned?: number;
        isFuel?: boolean; // Added helper for planned assignment
    }>;
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
        orderBy: { date: 'desc' },
        skip,
        take: limit,
        include: {
            vehicle: true,
            driver: {
                include: {
                    employee: true
                }
            },
            blank: true // WB-901
        }
    });

    return {
        data,
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

    return prisma.waybill.findFirst({
        where,
        include: {
            vehicle: true,
            driver: {
                include: {
                    employee: true
                }
            },
            blank: true, // WB-901
            fuelLines: true // WB-901
        }
    });
}

function formatBlankNumber(series: string | null, number: number): string {
    const s = series || '';
    const n = number.toString().padStart(6, '0');
    return s ? `${s} ${n}` : n;
}

export async function createWaybill(userInfo: UserInfo, input: CreateWaybillInput) {
    const organizationId = userInfo.organizationId;
    console.log('[WB-1005] createWaybill service called');

    const date = new Date(input.date);
    if (Number.isNaN(date.getTime())) {
        throw new BadRequestError('Некорректная дата');
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

    // Verify vehicle and driver exist and belong to organization
    const vehicle = await prisma.vehicle.findFirst({
        where: { id: input.vehicleId, organizationId }
    });
    if (!vehicle) throw new BadRequestError('Транспортное средство не найдено');

    // REL-701: Strict Driver.id enforcement. No more fallback to employeeId.
    const driver = await prisma.driver.findFirst({
        where: { id: targetDriverId, employee: { organizationId } }
    });

    if (!driver) throw new BadRequestError('Водитель не найден (неверный ID водителя)');

    // Use the actual driver ID for waybill creation
    const actualDriverId = driver.id;



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

    // Create waybill with fuelLines and routes
    return prisma.waybill.create({
        data: {
            organizationId,
            departmentId: vehicle.departmentId,
            number: waybillNumber,
            date: date,
            vehicleId: input.vehicleId,
            driverId: actualDriverId,
            blankId: validatedBlankId,
            odometerStart: input.odometerStart,
            odometerEnd: input.odometerEnd,
            isCityDriving: input.isCityDriving ?? false,
            isWarming: input.isWarming ?? false,
            fuelCalculationMethod: method as any,
            plannedRoute: input.plannedRoute,
            notes: input.notes,
            status: WaybillStatus.DRAFT,
            routes: input.routes && input.routes.length > 0 ? {
                create: input.routes.map(r => ({
                    legOrder: r.legOrder,
                    routeId: r.routeId || null,
                    fromPoint: r.fromPoint || null,
                    toPoint: r.toPoint || null,
                    distanceKm: r.distanceKm || 0,
                    isCityDriving: r.isCityDriving || false,
                    isWarming: r.isWarming || false,
                    comment: r.comment || null
                }))
            } : undefined,
            fuelLines: calculatedFuelLines.length > 0 ? {
                create: calculatedFuelLines.map(fl => ({
                    stockItemId: fl.stockItemId,
                    fuelStart: fl.fuelStart,
                    fuelReceived: fl.fuelReceived,
                    fuelConsumed: fl.fuelConsumed,
                    fuelEnd: fl.fuelEnd,
                    fuelPlanned: fl.fuelPlanned,
                }))
            } : undefined
        },
        include: {
            fuelLines: true,
            blank: true,
            routes: true
        }
    } as any);
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
        include: { vehicle: true, fuelLines: true }
    });
    if (!waybill) throw new NotFoundError('Путевой лист не найден');

    if (waybill.status === WaybillStatus.POSTED) {
        throw new BadRequestError('Нельзя редактировать проведённый путевой лист');
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
    let calculatedFuelLines = data.fuelLines;
    const vehicle = data.vehicleId ? await prisma.vehicle.findFirst({ where: { id: data.vehicleId } }) : waybill.vehicle;
    const waybillDate = data.date || waybill.date.toISOString().slice(0, 10);
    const odometerDistanceKm = calculateDistanceKm(newOdometerStart, newOdometerEnd);

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

    // Use transaction for consistency
    return await prisma.$transaction(async (tx) => {
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
                        comment: r.comment || null
                    }))
                });
            }
        }

        return tx.waybill.update({
            where: { id },
            data: {
                number: data.number,
                date: data.date ? new Date(data.date) : undefined,
                vehicleId: data.vehicleId,
                driverId: data.driverId,
                blankId: data.blankId,
                odometerStart: data.odometerStart,
                odometerEnd: data.odometerEnd,
                isCityDriving: data.isCityDriving,
                isWarming: data.isWarming,
                fuelCalculationMethod: data.fuelCalculationMethod as any,
                plannedRoute: data.plannedRoute,
                notes: data.notes
            },
            include: { fuelLines: true, routes: true }
        } as any);
    });
}

export async function deleteWaybill(userInfo: UserInfo, id: string) {
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

    // BLS-202: Release blank if it's in RESERVED status before deleting waybill
    if (waybill.blankId && waybill.blank?.status === BlankStatus.RESERVED) {
        try {
            await releaseBlank(organizationId, waybill.blankId);
            console.log('[BLS-202] Released blank on waybill delete:', waybill.blankId);
        } catch (err) {
            console.warn('[BLS-202] Could not release blank:', err);
        }
    }

    return prisma.waybill.delete({ where: { id } });
}

export async function changeWaybillStatus(
    userInfo: UserInfo,
    id: string,
    status: WaybillStatus,
    userId: string,
    hasOverridePermission: boolean = false // WB-701: Permission to override norm excess
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
        },
    });

    if (!waybill) throw new NotFoundError('Путевой лист не найден');

    // State machine validation (aligned with schema.prisma)
    const allowedTransitions: Record<WaybillStatus, WaybillStatus[]> = {
        [WaybillStatus.DRAFT]: [WaybillStatus.SUBMITTED, WaybillStatus.CANCELLED],
        [WaybillStatus.SUBMITTED]: [WaybillStatus.POSTED, WaybillStatus.CANCELLED],
        [WaybillStatus.POSTED]: [], // final state
        [WaybillStatus.CANCELLED]: [], // final state
    };

    const currentStatus = waybill.status;
    const allowed = allowedTransitions[currentStatus];

    if (!allowed.includes(status)) {
        throw new BadRequestError(
            `Переход из статуса ${currentStatus} в ${status} недопустим`
        );
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

        // Business logic для перехода в POSTED (завершенный ПЛ)
        if (status === WaybillStatus.POSTED) {
            // 1. Создать движения расхода топлива
            const { createExpenseMovement } = await import('./stockService');

            for (const fuelLine of waybill.fuelLines) {
                if (fuelLine.fuelConsumed && Number(fuelLine.fuelConsumed) > 0) {
                    await createExpenseMovement(
                        organizationId,
                        fuelLine.stockItemId,
                        Number(fuelLine.fuelConsumed),
                        'WAYBILL',
                        waybill.id,
                        userId,
                        null,
                        `Расход по ПЛ №${waybill.number} от ${waybill.date.toISOString().slice(0, 10)}`
                    );
                }
            }

            // 2. WB-501: Обновить статус бланка (ISSUED/RESERVED → USED)
            if (waybill.blankId && waybill.blank) {
                const blankStatus = waybill.blank.status;
                if (blankStatus === BlankStatus.ISSUED || blankStatus === BlankStatus.RESERVED) {
                    await tx.blank.update({
                        where: { id: waybill.blankId },
                        data: {
                            status: BlankStatus.USED,
                            usedAt: new Date(),
                        },
                    });
                    console.log('[WB-501] Blank status updated to USED:', waybill.blankId);
                }
            }
        }

        // Обновляем статус ПЛ
        const updated = await tx.waybill.update({
            where: { id },
            data: {
                status,
                ...(status === WaybillStatus.POSTED && { completedByUserId: userId }),
                ...(status === WaybillStatus.SUBMITTED && { approvedByUserId: userId }),
            },
        });

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

