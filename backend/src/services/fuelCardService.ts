import { PrismaClient } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../utils/errors';

const prisma = new PrismaClient();

// User context from authMiddleware
export interface AuthUser {
    id: string;
    organizationId: string;
    departmentId: string | null;
    role: string;
}

export interface CreateFuelCardDTO {
    cardNumber: string;
    provider?: string;
    isActive?: boolean;
    assignedToDriverId?: string;
    assignedToVehicleId?: string;
}

export interface UpdateFuelCardDTO {
    cardNumber?: string;
    provider?: string;
    isActive?: boolean;
    assignedToDriverId?: string | null;
    assignedToVehicleId?: string | null;
}

export async function listFuelCards(user: AuthUser) {
    return prisma.fuelCard.findMany({
        where: { organizationId: user.organizationId },
        orderBy: { createdAt: 'desc' },
        include: {
            organization: true,
            assignedToDriver: {
                include: {
                    employee: true,
                },
            },
            assignedToVehicle: true,
        },
    });
}

export async function getFuelCardById(user: AuthUser, id: string) {
    return prisma.fuelCard.findFirst({
        where: { id, organizationId: user.organizationId },
        include: {
            organization: true,
            assignedToDriver: {
                include: {
                    employee: true,
                },
            },
            assignedToVehicle: true,
        },
    });
}

export async function createFuelCard(user: AuthUser, data: CreateFuelCardDTO) {
    if (!data.cardNumber) {
        throw new BadRequestError('Номер карты обязателен');
    }

    // Check for duplicate card number
    const existing = await prisma.fuelCard.findUnique({
        where: { cardNumber: data.cardNumber },
    });

    if (existing) {
        throw new BadRequestError(`Карта с номером ${data.cardNumber} уже существует`);
    }

    // Validate driver exists if provided
    if (data.assignedToDriverId) {
        const driver = await prisma.driver.findUnique({
            where: { id: data.assignedToDriverId },
        });
        if (!driver) {
            throw new BadRequestError('Указанный водитель не найден');
        }
    }

    // Validate vehicle exists and belongs to same org if provided
    if (data.assignedToVehicleId) {
        const vehicle = await prisma.vehicle.findFirst({
            where: { id: data.assignedToVehicleId, organizationId: user.organizationId },
        });
        if (!vehicle) {
            throw new BadRequestError('Указанное ТС не найдено');
        }
    }

    return prisma.fuelCard.create({
        data: {
            organizationId: user.organizationId,
            cardNumber: data.cardNumber,
            provider: data.provider || null,
            isActive: data.isActive !== undefined ? data.isActive : true,
            assignedToDriverId: data.assignedToDriverId || null,
            assignedToVehicleId: data.assignedToVehicleId || null,
        },
        include: {
            organization: true,
            assignedToDriver: {
                include: {
                    employee: true,
                },
            },
            assignedToVehicle: true,
        },
    });
}

export async function updateFuelCard(user: AuthUser, id: string, data: UpdateFuelCardDTO) {
    await ensureSameOrg(user, id);

    const fuelCard = await prisma.fuelCard.findUnique({ where: { id } });

    // Check for duplicate card number if changing
    if (data.cardNumber && data.cardNumber !== fuelCard!.cardNumber) {
        const existing = await prisma.fuelCard.findUnique({
            where: { cardNumber: data.cardNumber },
        });
        if (existing) {
            throw new BadRequestError(`Карта с номером ${data.cardNumber} уже существует`);
        }
    }

    // Validate driver exists if provided
    if (data.assignedToDriverId) {
        const driver = await prisma.driver.findUnique({
            where: { id: data.assignedToDriverId },
        });
        if (!driver) {
            throw new BadRequestError('Указанный водитель не найден');
        }
    }

    // Validate vehicle exists and belongs to same org if provided
    if (data.assignedToVehicleId) {
        const vehicle = await prisma.vehicle.findFirst({
            where: { id: data.assignedToVehicleId, organizationId: user.organizationId },
        });
        if (!vehicle) {
            throw new BadRequestError('Указанное ТС не найдено');
        }
    }

    return prisma.fuelCard.update({
        where: { id },
        data: {
            cardNumber: data.cardNumber,
            provider: data.provider,
            isActive: data.isActive,
            assignedToDriverId: data.assignedToDriverId,
            assignedToVehicleId: data.assignedToVehicleId,
        },
        include: {
            organization: true,
            assignedToDriver: {
                include: {
                    employee: true,
                },
            },
            assignedToVehicle: true,
        },
    });
}

export async function deleteFuelCard(user: AuthUser, id: string) {
    await ensureSameOrg(user, id);

    // Check if card is used in any waybills
    const waybillsWithCard = await prisma.waybill.count({
        where: { fuelCardId: id },
    });

    if (waybillsWithCard > 0) {
        throw new BadRequestError(
            `Невозможно удалить карту: она используется в ${waybillsWithCard} путевых листах`
        );
    }

    return prisma.fuelCard.delete({
        where: { id },
    });
}

export async function assignFuelCard(
    user: AuthUser,
    id: string,
    driverId?: string | null,
    vehicleId?: string | null
) {
    await ensureSameOrg(user, id);

    // Validate driver exists if provided
    if (driverId) {
        const driver = await prisma.driver.findUnique({
            where: { id: driverId },
        });
        if (!driver) {
            throw new BadRequestError('Указанный водитель не найден');
        }
    }

    // Validate vehicle exists and belongs to same org if provided
    if (vehicleId) {
        const vehicle = await prisma.vehicle.findFirst({
            where: { id: vehicleId, organizationId: user.organizationId },
        });
        if (!vehicle) {
            throw new BadRequestError('Указанное ТС не найдено');
        }
    }

    return prisma.fuelCard.update({
        where: { id },
        data: {
            assignedToDriverId: driverId === null ? null : driverId,
            assignedToVehicleId: vehicleId === null ? null : vehicleId,
        },
        include: {
            organization: true,
            assignedToDriver: {
                include: {
                    employee: true,
                },
            },
            assignedToVehicle: true,
        },
    });
}

/**
 * Проверяет, что карта принадлежит организации пользователя
 */
async function ensureSameOrg(user: AuthUser, id: string) {
    const card = await prisma.fuelCard.findUnique({ where: { id } });
    if (!card || card.organizationId !== user.organizationId) {
        throw new NotFoundError('Топливная карта не найдена или доступ запрещён');
    }
}
