// Department Service - CRUD operations for departments
import { PrismaClient, Prisma } from '@prisma/client';
import { BadRequestError } from '../utils/errors';

const prisma = new PrismaClient();

export interface DepartmentFilters {
    organizationId?: string;
    page?: number;
    limit?: number;
}

export async function getDepartments(filters: DepartmentFilters = {}) {
    const {
        organizationId,
        page = 1,
        limit = 100,
    } = filters;

    const where: Prisma.DepartmentWhereInput = {};

    if (organizationId) {
        where.organizationId = organizationId;
    }

    const skip = (page - 1) * limit;

    const [departments, total] = await Promise.all([
        prisma.department.findMany({
            where,
            include: {
                organization: true,
            },
            orderBy: {
                name: 'asc',
            },
            skip,
            take: limit,
        }),
        prisma.department.count({ where }),
    ]);

    return {
        departments,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
}

export async function getDepartmentById(id: string) {
    return prisma.department.findUnique({
        where: { id },
        include: {
            organization: true,
        },
    });
}

export async function createDepartment(data: {
    organizationId: string;
    code?: string;
    name: string;
    address?: string;
}) {
    return prisma.department.create({
        data: {
            organizationId: data.organizationId,
            code: data.code || null,
            name: data.name,
            address: data.address || null,
        },
    });
}

export async function updateDepartment(
    id: string,
    data: Partial<{
        code: string;
        name: string;
        address: string;
    }>
) {
    const department = await prisma.department.findUnique({
        where: { id },
    });

    if (!department) {
        throw new BadRequestError('Department not found');
    }

    return prisma.department.update({
        where: { id },
        data,
    });
}

export async function deleteDepartment(id: string): Promise<void> {
    const department = await prisma.department.findUnique({
        where: { id },
    });

    if (!department) {
        throw new BadRequestError('Department not found');
    }

    // Check for dependencies (employees, vehicles, waybills)
    // For now, allow deletion - FK constraints will handle it
    // TODO: Add dependency check if needed

    await prisma.department.delete({
        where: { id },
    });
}
