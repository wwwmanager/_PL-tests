import { PrismaClient } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../utils/errors';

const prisma = new PrismaClient();

/**
 * List all fuel types (global directory)
 * Note: FuelType is a global dictionary, not organization-specific
 */
export async function listFuelTypes() {
    return prisma.fuelType.findMany({
        orderBy: { code: 'asc' },
    });
}

/**
 * Get fuel type by ID
 */
export async function getFuelTypeById(id: string) {
    return prisma.fuelType.findUnique({
        where: { id },
    });
}

/**
 * Create new fuel type
 */
export async function createFuelType(data: {
    code: string;
    name: string;
    density?: number | null;
}) {
    if (!data.code || data.code.trim().length === 0) {
        throw new BadRequestError('Код топлива обязателен');
    }

    if (!data.name || data.name.trim().length === 0) {
        throw new BadRequestError('Название топлива обязательно');
    }

    // Check for duplicate code
    const existing = await prisma.fuelType.findUnique({
        where: { code: data.code },
    });

    if (existing) {
        throw new BadRequestError('Топливо с таким кодом уже существует');
    }

    return prisma.fuelType.create({
        data: {
            code: data.code.trim().toUpperCase(),
            name: data.name.trim(),
            density: data.density || null,
        },
    });
}

/**
 * Update fuel type
 */
export async function updateFuelType(
    id: string,
    data: {
        code?: string;
        name?: string;
        density?: number | null;
    }
) {
    const fuelType = await prisma.fuelType.findUnique({
        where: { id },
    });

    if (!fuelType) {
        throw new NotFoundError('Тип топлива не найден');
    }

    // If updating code, check for duplicates
    if (data.code && data.code !== fuelType.code) {
        const existing = await prisma.fuelType.findUnique({
            where: { code: data.code },
        });

        if (existing) {
            throw new BadRequestError('Топливо с таким кодом уже существует');
        }
    }

    return prisma.fuelType.update({
        where: { id },
        data: {
            code: data.code?.trim().toUpperCase(),
            name: data.name?.trim(),
            density: data.density,
        },
    });
}

/**
 * Delete fuel type
 */
export async function deleteFuelType(id: string) {
    const fuelType = await prisma.fuelType.findUnique({
        where: { id },
    });

    if (!fuelType) {
        throw new NotFoundError('Тип топлива не найден');
    }

    return prisma.fuelType.delete({
        where: { id },
    });
}
