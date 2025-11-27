import { prisma } from '../db/prisma';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { WaybillStatus } from '@prisma/client';

interface CreateWaybillInput {
    number: string;
    date: string;
    vehicleId: string;
    driverId: string;
    odometerStart?: number;
    plannedRoute?: string;
    notes?: string;
}

export async function listWaybills(organizationId: string, filters?: {
    startDate?: string;
    endDate?: string;
    vehicleId?: string;
    driverId?: string;
    status?: WaybillStatus;
}) {
    const where: any = { organizationId };

    if (filters) {
        if (filters.startDate || filters.endDate) {
            where.date = {};
            if (filters.startDate) where.date.gte = new Date(filters.startDate);
            if (filters.endDate) where.date.lte = new Date(filters.endDate);
        }
        if (filters.vehicleId) where.vehicleId = filters.vehicleId;
        if (filters.driverId) where.driverId = filters.driverId;
        if (filters.status) where.status = filters.status;
    }

    return prisma.waybill.findMany({
        where,
        include: {
            vehicle: true,
            driver: { include: { employee: true } }
        },
        orderBy: { date: 'desc' }
    });
}

export async function getWaybillById(organizationId: string, id: string) {
    return prisma.waybill.findFirst({
        where: { id, organizationId },
        include: {
            vehicle: true,
            driver: { include: { employee: true } }
        }
    });
}

export async function createWaybill(organizationId: string, input: CreateWaybillInput) {
    const date = new Date(input.date);
    if (Number.isNaN(date.getTime())) {
        throw new BadRequestError('Некорректная дата');
    }

    // Проверяем, что vehicle и driver принадлежат этой организации
    const vehicle = await prisma.vehicle.findFirst({
        where: { id: input.vehicleId, organizationId }
    });
    if (!vehicle) {
        throw new BadRequestError('Транспортное средство не найдено');
    }

    const driver = await prisma.driver.findFirst({
        where: {
            id: input.driverId,
            employee: { organizationId }
        }
    });
    if (!driver) {
        throw new BadRequestError('Водитель не найден');
    }

    return prisma.waybill.create({
        data: {
            organizationId,
            number: input.number,
            date,
            vehicleId: input.vehicleId,
            driverId: input.driverId,
            odometerStart: input.odometerStart,
            plannedRoute: input.plannedRoute,
            notes: input.notes
        },
        include: {
            vehicle: true,
            driver: { include: { employee: true } }
        }
    });
}

interface UpdateWaybillInput {
    number?: string;
    date?: string;
    vehicleId?: string;
    driverId?: string;
    status?: WaybillStatus;
    odometerStart?: number;
    odometerEnd?: number;
    plannedRoute?: string;
    notes?: string;
}

export async function updateWaybill(organizationId: string, id: string, input: UpdateWaybillInput) {
    const existing = await prisma.waybill.findFirst({
        where: { id, organizationId }
    });

    if (!existing) {
        throw new NotFoundError('Путевой лист не найден');
    }

    const updateData: any = {};

    if (input.number !== undefined) updateData.number = input.number;
    if (input.date) updateData.date = new Date(input.date);
    if (input.vehicleId !== undefined) updateData.vehicleId = input.vehicleId;
    if (input.driverId !== undefined) updateData.driverId = input.driverId;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.odometerStart !== undefined) updateData.odometerStart = input.odometerStart;
    if (input.odometerEnd !== undefined) updateData.odometerEnd = input.odometerEnd;
    if (input.plannedRoute !== undefined) updateData.plannedRoute = input.plannedRoute;
    if (input.notes !== undefined) updateData.notes = input.notes;

    return prisma.waybill.update({
        where: { id },
        data: updateData,
        include: {
            vehicle: true,
            driver: { include: { employee: true } }
        }
    });
}

export async function deleteWaybill(organizationId: string, id: string) {
    const waybill = await prisma.waybill.findFirst({
        where: { id, organizationId }
    });

    if (!waybill) {
        throw new NotFoundError('Путевой лист не найден');
    }

    return prisma.waybill.delete({
        where: { id }
    });
}

// Метод для изменения статуса
export async function changeWaybillStatus(organizationId: string, id: string, status: WaybillStatus) {
    const waybill = await prisma.waybill.findFirst({
        where: { id, organizationId }
    });

    if (!waybill) {
        throw new NotFoundError('Путевой лист не найден');
    }

    // Здесь можно добавить валидацию переходов статусов (state machine)
    // например, из DRAFT можно перейти только в APPROVED и т.д.

    return prisma.waybill.update({
        where: { id },
        data: { status },
        include: {
            vehicle: true,
            driver: { include: { employee: true } }
        }
    });
}
