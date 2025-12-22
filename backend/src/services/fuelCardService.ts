import { PrismaClient, TopUpScheduleType } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { computeNextRunAt } from '../utils/topUpUtils';

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
 * REL-601: Get fuel cards assigned to a specific driver
 * @param driverId - Driver ID (references Driver table)
 * @returns List of fuel cards
 */
export async function getFuelCardsForDriver(organizationId: string, driverId: string) {
    return prisma.fuelCard.findMany({
        where: {
            organizationId,
            assignedToDriverId: driverId,
            isActive: true
        },
        select: {
            id: true,
            cardNumber: true,
            provider: true
        },
        orderBy: { cardNumber: 'asc' }
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

// ============================================================================
// FUEL-001: Top-Up Rules and Transactions
// ============================================================================

/**
 * Get top-up rule for a fuel card
 */
export async function getTopUpRule(organizationId: string, fuelCardId: string) {
    return prisma.fuelCardTopUpRule.findFirst({
        where: { organizationId, fuelCardId }
    });
}

/**
 * Create or update top-up rule
 */
export async function upsertTopUpRule(
    organizationId: string,
    fuelCardId: string,
    data: {
        scheduleType: 'DAILY' | 'WEEKLY' | 'MONTHLY';
        amountLiters: number;
        minBalanceLiters?: number;
        timezone?: string;
        isActive?: boolean;
    }
) {
    const existing = await prisma.fuelCardTopUpRule.findFirst({
        where: { organizationId, fuelCardId }
    });

    const nextRunAt = computeNextRunAt(new Date(), data.scheduleType as TopUpScheduleType);

    if (existing) {
        return prisma.fuelCardTopUpRule.update({
            where: { id: existing.id },
            data: {
                scheduleType: data.scheduleType,
                amountLiters: data.amountLiters,
                minBalanceLiters: data.minBalanceLiters ?? null,
                timezone: data.timezone ?? 'Europe/Moscow',
                isActive: data.isActive ?? true,
                nextRunAt
            }
        });
    }

    return prisma.fuelCardTopUpRule.create({
        data: {
            organizationId,
            fuelCardId,
            scheduleType: data.scheduleType,
            amountLiters: data.amountLiters,
            minBalanceLiters: data.minBalanceLiters ?? null,
            timezone: data.timezone ?? 'Europe/Moscow',
            isActive: data.isActive ?? true,
            nextRunAt
        }
    });
}

/**
 * Delete (deactivate) top-up rule
 */
export async function deleteTopUpRule(organizationId: string, fuelCardId: string) {
    const rule = await prisma.fuelCardTopUpRule.findFirst({
        where: { organizationId, fuelCardId }
    });
    if (rule) {
        await prisma.fuelCardTopUpRule.update({
            where: { id: rule.id },
            data: { isActive: false }
        });
    }
}

/**
 * Get transactions for a fuel card
 */
export async function getTransactions(
    organizationId: string,
    fuelCardId: string,
    from?: string,
    to?: string
) {
    const where: any = { organizationId, fuelCardId };

    if (from || to) {
        where.createdAt = {};
        if (from) where.createdAt.gte = new Date(from);
        if (to) where.createdAt.lte = new Date(to);
    }

    return prisma.fuelCardTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100
    });
}

/**
 * Create manual transaction (adjustment)
 */
export async function createTransaction(
    user: AuthUser,
    fuelCardId: string,
    data: {
        type: 'TOPUP' | 'ADJUSTMENT' | 'DEBIT';
        amountLiters: number;
        reason?: string;
    }
) {
    const card = await prisma.fuelCard.findFirst({
        where: { id: fuelCardId, organizationId: user.organizationId }
    });
    if (!card) {
        throw new NotFoundError('Топливная карта не найдена');
    }

    return prisma.$transaction(async (tx) => {
        const transaction = await tx.fuelCardTransaction.create({
            data: {
                organizationId: user.organizationId,
                fuelCardId,
                type: data.type,
                amountLiters: data.amountLiters,
                reason: data.reason ?? 'MANUAL',
                createdByUserId: user.id
            }
        });

        // Update balance
        const delta = data.type === 'DEBIT' ? -data.amountLiters : data.amountLiters;
        await tx.fuelCard.update({
            where: { id: fuelCardId },
            data: { balanceLiters: { increment: delta } }
        });

        return transaction;
    });
}
