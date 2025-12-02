import { PrismaClient } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../utils/errors';

const prisma = new PrismaClient();

export async function listVehicles(organizationId: string) {
    return prisma.vehicle.findMany({
        where: { organizationId },
        orderBy: { registrationNumber: 'asc' },
        include: {
            organization: true,
            department: true,
        },
    });
}

export async function getVehicleById(organizationId: string, id: string) {
    return prisma.vehicle.findFirst({
        where: { id, organizationId },
        include: {
            organization: true,
            department: true,
        },
    });
}

export async function createVehicle(organizationId: string, data: any) {
    // Validate required fields
    if (!data.registrationNumber) {
        throw new BadRequestError('Номер регистрации обязателен');
    }

    return prisma.vehicle.create({
        data: {
            organizationId,
            departmentId: data.departmentId || null,
            code: data.code || null,
            registrationNumber: data.registrationNumber,
            brand: data.brand || null,
            model: data.model || null,
            vin: data.vin || null,
            fuelType: data.fuelType || null,
            fuelTankCapacity: data.fuelTankCapacity ? Number(data.fuelTankCapacity) : null,
            isActive: data.isActive !== undefined ? data.isActive : true,
        },
    });
}

export async function updateVehicle(organizationId: string, id: string, data: any) {
    const vehicle = await prisma.vehicle.findFirst({
        where: { id, organizationId },
    });

    if (!vehicle) {
        throw new NotFoundError('Транспортное средство не найдено');
    }

    return prisma.vehicle.update({
        where: { id },
        data: {
            code: data.code,
            registrationNumber: data.registrationNumber,
            brand: data.brand,
            model: data.model,
            vin: data.vin,
            fuelType: data.fuelType,
            fuelTankCapacity: data.fuelTankCapacity ? Number(data.fuelTankCapacity) : undefined,
            isActive: data.isActive,
            departmentId: data.departmentId,
        },
    });
}

export async function deleteVehicle(organizationId: string, id: string) {
    const vehicle = await prisma.vehicle.findFirst({
        where: { id, organizationId },
    });

    if (!vehicle) {
        throw new NotFoundError('Транспортное средство не найдено');
    }

    return prisma.vehicle.delete({
        where: { id },
    });
}
