import { PrismaClient } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../utils/errors';

const prisma = new PrismaClient();

/**
 * List all warehouses for specified organization
 */
export async function listWarehouses(organizationId: string) {
    return prisma.warehouse.findMany({
        where: { organizationId },
        orderBy: { name: 'asc' },
        include: {
            organization: true,
            department: true,
        },
    });
}

/**
 * Get warehouse by ID
 */
export async function getWarehouseById(organizationId: string, id: string) {
    return prisma.warehouse.findFirst({
        where: { id, organizationId },
        include: {
            organization: true,
            department: true,
        },
    });
}

/**
 * Create new warehouse
 */
export async function createWarehouse(data: {
    organizationId: string;
    name: string;
    address?: string | null;
    departmentId?: string | null;
}) {
    if (!data.name || data.name.trim().length === 0) {
        throw new BadRequestError('Название склада обязательно');
    }

    return prisma.warehouse.create({
        data: {
            organizationId: data.organizationId,
            name: data.name.trim(),
            address: data.address || null,
            departmentId: data.departmentId || null,
        },
    });
}

/**
 * Update warehouse
 */
export async function updateWarehouse(
    organizationId: string,
    id: string,
    data: {
        name?: string;
        address?: string | null;
        departmentId?: string | null;
    }
) {
    const warehouse = await prisma.warehouse.findFirst({
        where: { id, organizationId },
    });

    if (!warehouse) {
        throw new NotFoundError('Склад не найден');
    }

    return prisma.warehouse.update({
        where: { id },
        data: {
            name: data.name,
            address: data.address,
            departmentId: data.departmentId,
        },
    });
}

/**
 * Delete warehouse
 */
export async function deleteWarehouse(organizationId: string, id: string) {
    const warehouse = await prisma.warehouse.findFirst({
        where: { id, organizationId },
    });

    if (!warehouse) {
        throw new NotFoundError('Склад не найден');
    }

    return prisma.warehouse.delete({
        where: { id },
    });
}
