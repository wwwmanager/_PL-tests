// Employee Service - CRUD operations for employees
import { PrismaClient, Prisma } from '@prisma/client';
import { BadRequestError } from '../utils/errors';

const prisma = new PrismaClient();

export interface EmployeeFilters {
    organizationId?: string;
    departmentId?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
}

export async function getEmployees(filters: EmployeeFilters = {}) {
    const {
        organizationId,
        departmentId,
        isActive,
        page = 1,
        limit = 100,
    } = filters;

    const where: Prisma.EmployeeWhereInput = {};

    if (organizationId) {
        where.organizationId = organizationId;
    }

    if (departmentId) {
        where.departmentId = departmentId;
    }

    if (isActive !== undefined) {
        where.isActive = isActive;
    }

    const skip = (page - 1) * limit;

    const [employees, total] = await Promise.all([
        prisma.employee.findMany({
            where,
            include: {
                organization: true,
                department: true,
            },
            orderBy: {
                fullName: 'asc',
            },
            skip,
            take: limit,
        }),
        prisma.employee.count({ where }),
    ]);

    return {
        employees,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
}

export async function getEmployeeById(id: string) {
    return prisma.employee.findUnique({
        where: { id },
        include: {
            organization: true,
            department: true,
        },
    });
}

export async function createEmployee(data: {
    organizationId: string;
    departmentId?: string;
    fullName: string;
    position: string;
    isActive?: boolean;
}) {
    return prisma.employee.create({
        data: {
            organizationId: data.organizationId,
            departmentId: data.departmentId || null,
            fullName: data.fullName,
            position: data.position,
            isActive: data.isActive !== undefined ? data.isActive : true,
        },
    });
}

export async function updateEmployee(
    id: string,
    data: Partial<{
        departmentId: string;
        fullName: string;
        position: string;
        isActive: boolean;
    }>
) {
    const employee = await prisma.employee.findUnique({
        where: { id },
    });

    if (!employee) {
        throw new BadRequestError('Employee not found');
    }

    return prisma.employee.update({
        where: { id },
        data,
    });
}

export async function deleteEmployee(id: string): Promise<void> {
    const employee = await prisma.employee.findUnique({
        where: { id },
    });

    if (!employee) {
        throw new BadRequestError('Employee not found');
    }

    // Soft delete - set isActive to false
    await prisma.employee.update({
        where: { id },
        data: { isActive: false },
    });
}
