import { prisma } from '../db/prisma';

export async function listVehicles(organizationId: string) {
    return prisma.vehicle.findMany({
        where: { organizationId },
        orderBy: { registrationNumber: 'asc' }
    });
}

export async function getVehicleById(organizationId: string, id: string) {
    return prisma.vehicle.findFirst({
        where: { id, organizationId }
    });
}

interface CreateVehicleInput {
    code?: string;
    registrationNumber: string;
    brand?: string;
    model?: string;
    fuelType?: string;
}

export async function createVehicle(organizationId: string, input: CreateVehicleInput) {
    return prisma.vehicle.create({
        data: {
            organizationId,
            ...input
        }
    });
}

interface UpdateVehicleInput {
    code?: string;
    registrationNumber?: string;
    brand?: string;
    model?: string;
    fuelType?: string;
    isActive?: boolean;
}

export async function updateVehicle(organizationId: string, id: string, input: UpdateVehicleInput) {
    return prisma.vehicle.updateMany({
        where: { id, organizationId },
        data: input
    });
}

export async function deleteVehicle(organizationId: string, id: string) {
    return prisma.vehicle.deleteMany({
        where: { id, organizationId }
    });
}
