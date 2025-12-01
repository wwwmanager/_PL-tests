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

export async function listWaybills(organizationId: string, filters?: {
    startDate?: string;
    endDate?: string;
    vehicleId?: string;
    driverId?: string;
    status?: WaybillStatus;
    departmentId?: string; // Added for isolation
}) {
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
    }

    return prisma.waybill.findMany({
        where,
        orderBy: { date: 'desc' },
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

export async function changeWaybillStatus(organizationId: string, id: string, status: WaybillStatus) {
    const waybill = await prisma.waybill.findFirst({ where: { id, organizationId } });
    if (!waybill) throw new NotFoundError('Путевой лист не найден');

    // TODO: Add state machine validation here

    return prisma.waybill.update({
        where: { id },
        data: { status }
    });
}
