import { PrismaClient } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../utils/errors';

const prisma = new PrismaClient();

/**
 * List all routes (global directory)
 */
export async function listRoutes() {
    return prisma.route.findMany({
        orderBy: { name: 'asc' },
    });
}

/**
 * Get route by ID
 */
export async function getRouteById(id: string) {
    return prisma.route.findUnique({
        where: { id },
    });
}

/**
 * Create new route
 */
export async function createRoute(data: {
    name: string;
    startPoint?: string | null;
    endPoint?: string | null;
    distance?: number | null;
    estimatedTime?: number | null;
}) {
    if (!data.name || data.name.trim().length === 0) {
        throw new BadRequestError('Название маршрута обязательно');
    }

    return prisma.route.create({
        data: {
            name: data.name.trim(),
            startPoint: data.startPoint?.trim() || null,
            endPoint: data.endPoint?.trim() || null,
            distance: data.distance || null,
            estimatedTime: data.estimatedTime || null,
        },
    });
}

/**
 * Update route
 */
export async function updateRoute(
    id: string,
    data: {
        name?: string;
        startPoint?: string | null;
        endPoint?: string | null;
        distance?: number | null;
        estimatedTime?: number | null;
    }
) {
    const route = await prisma.route.findUnique({
        where: { id },
    });

    if (!route) {
        throw new NotFoundError('Маршрут не найден');
    }

    return prisma.route.update({
        where: { id },
        data: {
            name: data.name?.trim(),
            startPoint: data.startPoint?.trim(),
            endPoint: data.endPoint?.trim(),
            distance: data.distance,
            estimatedTime: data.estimatedTime,
        },
    });
}

/**
 * Delete route
 */
export async function deleteRoute(id: string) {
    const route = await prisma.route.findUnique({
        where: { id },
    });

    if (!route) {
        throw new NotFoundError('Маршрут не найден');
    }

    return prisma.route.delete({
        where: { id },
    });
}
