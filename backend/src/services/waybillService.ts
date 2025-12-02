import { PrismaClient, WaybillStatus } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../utils/errors';

const prisma = new PrismaClient();

interface CreateWaybillInput {
    number: string;
    date: string;
    vehicleId: string;
    driverId: string;
    blankId?: string | null;
    odometerStart?: number;
    odometerEnd?: number;
    plannedRoute?: string;
    notes?: string;
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
    console.log('📝 createWaybill service called (Prisma)');

    const date = new Date(input.date);
    if (Number.isNaN(date.getTime())) {
        throw new BadRequestError('Некорректная дата');
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

    // Create waybill
    return prisma.waybill.create({
        data: {
            organizationId,
            departmentId: vehicle.departmentId, // Inherit department from vehicle
            number: input.number,
            date: date,
            vehicleId: input.vehicleId,
            driverId: input.driverId,
            blankId: input.blankId || null,
            odometerStart: input.odometerStart,
            odometerEnd: input.odometerEnd,
            plannedRoute: input.plannedRoute,
            notes: input.notes,
            status: WaybillStatus.DRAFT
        }
    });
}

export async function updateWaybill(organizationId: string, id: string, data: Partial<CreateWaybillInput>) {
    const waybill = await prisma.waybill.findFirst({ where: { id, organizationId } });
    if (!waybill) throw new NotFoundError('Путевой лист не найден');

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
            plannedRoute: data.plannedRoute,
            notes: data.notes
        }
    });
}

export async function deleteWaybill(organizationId: string, id: string) {
    const waybill = await prisma.waybill.findFirst({ where: { id, organizationId } });
    if (!waybill) throw new NotFoundError('Путевой лист не найден');

    return prisma.waybill.delete({ where: { id } });
}

export async function changeWaybillStatus(
    organizationId: string,
    id: string,
    status: WaybillStatus,
    userId: string
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
                    null, // warehouseId - можно доработать, если складов несколько
                    `Расход по ПЛ №${waybill.number} от ${waybill.date.toISOString().slice(0, 10)}`
                );
            }
        }

        // 2. Обновить статус бланка (ISSUED → USED)
        if (waybill.blankId && waybill.blank?.status === 'ISSUED') {
            await prisma.blank.update({
                where: { id: waybill.blankId },
                data: {
                    status: 'USED',
                    usedAt: new Date(),
                },
            });
        }
    }

    // Обновляем статус ПЛ
    const updated = await prisma.waybill.update({
        where: { id },
        data: {
            status,
            ...(status === WaybillStatus.POSTED && { completedByUserId: userId }),
            ...(status === WaybillStatus.SUBMITTED && { approvedByUserId: userId }),
        },
    });

    // Логируем в audit
    await prisma.auditLog.create({
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

    return updated;
}

