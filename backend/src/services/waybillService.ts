import { PrismaClient, WaybillStatus, BlankStatus } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { validateOdometer, calculateDistanceKm, calculatePlannedFuel, FuelConsumptionRates, DrivingFlags } from '../domain/waybill/fuel';
import { isWinterDate } from '../utils/dateUtils';
import { getSeasonSettings } from './settingsService';
import { reserveNextBlankForDriver, reserveSpecificBlank, releaseBlank } from './blankService';

const prisma = new PrismaClient();

interface CreateWaybillInput {
    number: string;
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
    fuelLines?: Array<{
        stockItemId: string;
        fuelStart?: number;
        fuelReceived?: number;
        fuelConsumed?: number;
        fuelEnd?: number;
        fuelPlanned?: number;
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
    organizationId: string,
    filters?: ListWaybillsFilters,
    pagination?: PaginationParams
) {
    const where: any = {
        organizationId,
    };

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
            }
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

export async function getWaybillById(organizationId: string, id: string) {
    return prisma.waybill.findFirst({
        where: { id, organizationId },
        include: {
            vehicle: true,
            driver: {
                include: {
                    employee: true
                }
            }
        }
    });
}

export async function createWaybill(organizationId: string, input: CreateWaybillInput) {
    console.log('[WB-402] createWaybill service called');

    const date = new Date(input.date);
    if (Number.isNaN(date.getTime())) {
        throw new BadRequestError('Некорректная дата');
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

    const driver = await prisma.driver.findFirst({
        where: { id: input.driverId, employee: { organizationId } }
    });
    if (!driver) throw new BadRequestError('Водитель не найден');

    // BLS-202: Reserve blank for this waybill
    let validatedBlankId: string | null = null;

    try {
        if (input.blankId) {
            // Reserve specific blank if ID provided
            const result = await reserveSpecificBlank(
                organizationId,
                input.blankId,
                input.driverId,
                vehicle.departmentId ?? undefined
            );
            validatedBlankId = result.blank.id;
            console.log('[BLS-202] Reserved specific blank:', result.blank);
        } else {
            // Auto-reserve next available blank for driver
            try {
                const result = await reserveNextBlankForDriver(
                    organizationId,
                    input.driverId,
                    vehicle.departmentId ?? undefined
                );
                validatedBlankId = result.blank.id;
                console.log('[BLS-202] Auto-reserved blank:', result.blank);
            } catch (err) {
                // No available blanks - continue without blank (optional for some workflows)
                console.warn('[BLS-202] No blanks available for auto-reservation, continuing without blank');
            }
        }
    } catch (err: any) {
        throw new BadRequestError(err.message || 'Ошибка резервирования бланка');
    }

    // WB-402: Calculate fuelPlanned if we have odometer data and vehicle rates
    let calculatedFuelLines = input.fuelLines || [];
    const distanceKm = calculateDistanceKm(input.odometerStart, input.odometerEnd);

    if (distanceKm !== null && distanceKm > 0 && vehicle.fuelConsumptionRates) {
        // Get season settings to determine if winter
        const seasonSettings = await getSeasonSettings();
        const isWinter = isWinterDate(input.date, seasonSettings);

        const rates = vehicle.fuelConsumptionRates as FuelConsumptionRates;
        const flags: DrivingFlags = {
            isCityDriving: input.isCityDriving ?? false,
            isWarming: input.isWarming ?? false
        };

        // Calculate planned fuel
        const fuelPlanned = calculatePlannedFuel(distanceKm, rates, flags, isWinter);

        console.log('[WB-402] Fuel calculation:', {
            distanceKm,
            isWinter,
            isCityDriving: flags.isCityDriving,
            isWarming: flags.isWarming,
            fuelPlanned
        });

        // If we have fuel lines, add fuelPlanned to first one; otherwise create placeholder
        if (calculatedFuelLines.length > 0) {
            calculatedFuelLines = calculatedFuelLines.map((fl, index) => ({
                ...fl,
                fuelPlanned: index === 0 ? fuelPlanned : fl.fuelPlanned
            }));
        }
    }

    // Create waybill with fuelLines
    return prisma.waybill.create({
        data: {
            organizationId,
            departmentId: vehicle.departmentId, // Inherit department from vehicle
            number: input.number,
            date: date,
            vehicleId: input.vehicleId,
            driverId: input.driverId,
            blankId: validatedBlankId,
            odometerStart: input.odometerStart,
            odometerEnd: input.odometerEnd,
            isCityDriving: input.isCityDriving ?? false,
            isWarming: input.isWarming ?? false,
            plannedRoute: input.plannedRoute,
            notes: input.notes,
            status: WaybillStatus.DRAFT,
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
            fuelLines: true
        }
    });
}

export async function updateWaybill(organizationId: string, id: string, data: Partial<CreateWaybillInput>) {
    const waybill = await prisma.waybill.findFirst({
        where: { id, organizationId },
        include: { vehicle: true, fuelLines: true }
    });
    if (!waybill) throw new NotFoundError('Путевой лист не найден');

    // WB-403: Forbid editing POSTED waybills
    if (waybill.status === WaybillStatus.POSTED) {
        throw new BadRequestError('Нельзя редактировать проведённый путевой лист');
    }

    // WB-403: Validate odometer if both provided
    const newOdometerStart = data.odometerStart !== undefined ? data.odometerStart : waybill.odometerStart?.toNumber();
    const newOdometerEnd = data.odometerEnd !== undefined ? data.odometerEnd : waybill.odometerEnd?.toNumber();

    if (newOdometerStart !== undefined && newOdometerEnd !== undefined) {
        const odometerValidation = validateOdometer(newOdometerStart, newOdometerEnd);
        if (!odometerValidation.isValid) {
            throw new BadRequestError(odometerValidation.error!);
        }
    }

    // WB-403: Recalculate fuelPlanned if odometer or flags changed
    let calculatedFuelLines = data.fuelLines;
    const vehicle = data.vehicleId ? await prisma.vehicle.findFirst({ where: { id: data.vehicleId } }) : waybill.vehicle;
    const waybillDate = data.date || waybill.date.toISOString().slice(0, 10);
    const distanceKm = calculateDistanceKm(newOdometerStart, newOdometerEnd);

    if (distanceKm !== null && distanceKm > 0 && vehicle?.fuelConsumptionRates) {
        const seasonSettings = await getSeasonSettings();
        const isWinter = isWinterDate(waybillDate, seasonSettings);

        const rates = vehicle.fuelConsumptionRates as FuelConsumptionRates;
        const flags: DrivingFlags = {
            isCityDriving: data.isCityDriving ?? Boolean(waybill.isCityDriving),
            isWarming: data.isWarming ?? Boolean(waybill.isWarming)
        };

        const fuelPlanned = calculatePlannedFuel(distanceKm, rates, flags, isWinter);

        console.log('[WB-403] Fuel recalculation:', { distanceKm, isWinter, fuelPlanned });

        // Update fuelPlanned in fuel lines
        if (calculatedFuelLines && calculatedFuelLines.length > 0) {
            calculatedFuelLines = calculatedFuelLines.map((fl, index) => ({
                ...fl,
                fuelPlanned: index === 0 ? fuelPlanned : fl.fuelPlanned
            }));
        } else if (waybill.fuelLines.length > 0) {
            // Update existing fuelLines[0] with new planned
            await prisma.waybillFuel.update({
                where: { id: waybill.fuelLines[0].id },
                data: { fuelPlanned }
            });
        }
    }

    // WB-403: Replace fuelLines if provided (delete old, create new)
    if (calculatedFuelLines !== undefined) {
        await prisma.$transaction(async (tx) => {
            // Delete existing fuel lines
            await tx.waybillFuel.deleteMany({ where: { waybillId: id } });

            // Create new ones if provided
            if (calculatedFuelLines && calculatedFuelLines.length > 0) {
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
        });
    }

    return prisma.waybill.update({
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
            plannedRoute: data.plannedRoute,
            notes: data.notes
        },
        include: { fuelLines: true }
    });
}

export async function deleteWaybill(organizationId: string, id: string) {
    const waybill = await prisma.waybill.findFirst({
        where: { id, organizationId },
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
    organizationId: string,
    id: string,
    status: WaybillStatus,
    userId: string,
    hasOverridePermission: boolean = false // WB-701: Permission to override norm excess
) {
    const waybill = await prisma.waybill.findFirst({
        where: { id, organizationId },
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

