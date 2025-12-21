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
 * Create new warehouse with auto-created StockLocation
 * WH-FIX-RESP-LOC-001: Uses transaction to create both Warehouse and StockLocation
 */
export async function createWarehouse(data: {
    organizationId: string;
    name: string;
    address?: string | null;
    departmentId?: string | null;
    responsibleEmployeeId?: string | null;  // WH-FIX-RESP-LOC-001
    description?: string | null;
    type?: string | null;
    status?: string | null;
}) {
    if (!data.name || data.name.trim().length === 0) {
        throw new BadRequestError('Название склада обязательно');
    }

    // WH-FIX-RESP-LOC-001: Transaction to create Warehouse + StockLocation
    return prisma.$transaction(async (tx) => {
        const warehouse = await tx.warehouse.create({
            data: {
                organizationId: data.organizationId,
                name: data.name.trim(),
                address: data.address || null,
                departmentId: data.departmentId || null,
                responsibleEmployeeId: data.responsibleEmployeeId || null,
                description: data.description || null,
                type: data.type || null,
                status: data.status || 'active',
            },
        });

        // WH-FIX-RESP-LOC-001: Auto-create StockLocation for warehouse
        await tx.stockLocation.create({
            data: {
                organizationId: data.organizationId,
                departmentId: data.departmentId || null,
                type: 'WAREHOUSE',
                name: warehouse.name,
                warehouseId: warehouse.id,
                isActive: true,
            },
        });

        console.log(`[WH-FIX-RESP-LOC-001] Created Warehouse ${warehouse.id} with StockLocation`);

        return warehouse;
    });
}

/**
 * Update warehouse
 * WH-FIX-RESP-LOC-001: Added support for responsibleEmployeeId and other new fields
 */
export async function updateWarehouse(
    organizationId: string,
    id: string,
    data: {
        name?: string;
        address?: string | null;
        departmentId?: string | null;
        responsibleEmployeeId?: string | null;  // WH-FIX-RESP-LOC-001
        description?: string | null;
        type?: string | null;
        status?: string | null;
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
            responsibleEmployeeId: data.responsibleEmployeeId,
            description: data.description,
            type: data.type,
            // status is required, only update if provided
            ...(data.status ? { status: data.status } : {}),
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
