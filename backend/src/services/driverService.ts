import { prisma } from '../db/prisma';

export async function listDrivers(organizationId: string) {
    return prisma.driver.findMany({
        where: { employee: { organizationId } },
        include: { employee: true },
        orderBy: { employee: { fullName: 'asc' } }
    });
}

export async function getDriverById(organizationId: string, id: string) {
    return prisma.driver.findFirst({
        where: {
            id,
            employee: { organizationId }
        },
        include: { employee: true }
    });
}

interface CreateDriverInput {
    fullName: string;
    position?: string;
    phone?: string;
    licenseNumber: string;
    licenseCategory?: string;
    licenseValidTo?: string;
}

export async function createDriver(organizationId: string, input: CreateDriverInput) {
    const { fullName, position, phone, licenseNumber, licenseCategory, licenseValidTo } = input;

    // Создаём сначала Employee, затем Driver
    return prisma.employee.create({
        data: {
            organizationId,
            fullName,
            position,
            phone,
            driver: {
                create: {
                    licenseNumber,
                    licenseCategory,
                    licenseValidTo: licenseValidTo ? new Date(licenseValidTo) : undefined
                }
            }
        },
        include: { driver: true }
    });
}

interface UpdateDriverInput {
    fullName?: string;
    position?: string;
    phone?: string;
    licenseNumber?: string;
    licenseCategory?: string;
    licenseValidTo?: string;
    isActive?: boolean;
}

export async function updateDriver(organizationId: string, id: string, input: UpdateDriverInput) {
    const { fullName, position, phone, licenseNumber, licenseCategory, licenseValidTo, isActive } = input;

    const driver = await prisma.driver.findFirst({
        where: { id, employee: { organizationId } },
        include: { employee: true }
    });

    if (!driver) return null;

    // Обновляем Employee и Driver
    return prisma.employee.update({
        where: { id: driver.employeeId },
        data: {
            fullName,
            position,
            phone,
            isActive,
            driver: {
                update: {
                    licenseNumber,
                    licenseCategory,
                    licenseValidTo: licenseValidTo ? new Date(licenseValidTo) : undefined
                }
            }
        },
        include: { driver: true }
    });
}

export async function deleteDriver(organizationId: string, id: string) {
    const driver = await prisma.driver.findFirst({
        where: { id, employee: { organizationId } }
    });

    if (!driver) return null;

    // Удаляем Employee (каскадно удалится Driver)
    return prisma.employee.delete({
        where: { id: driver.employeeId }
    });
}
