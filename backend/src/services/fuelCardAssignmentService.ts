/**
 * REL-106: Fuel Card Assignment Service
 * 
 * Manages fuel card assignments with validFrom/validTo periods.
 * Enables provider switching and card validity checks.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// Assignment Validation
// ============================================================================

/**
 * Check if a fuel card is valid at a specific date
 * Returns the active assignment if exists, null otherwise
 */
export async function getActiveAssignment(
    fuelCardId: string,
    asOf: Date = new Date()
) {
    const assignment = await prisma.fuelCardAssignment.findFirst({
        where: {
            fuelCardId,
            validFrom: { lte: asOf },
            OR: [
                { validTo: null },
                { validTo: { gte: asOf } },
            ],
        },
        include: {
            driver: { include: { employee: true } },
            vehicle: true,
        },
        orderBy: { validFrom: 'desc' },
    });

    return assignment;
}

/**
 * Check if a fuel card can be used at a specific date
 * Card must be active AND have a valid assignment
 */
export async function isCardValidAt(
    fuelCardId: string,
    asOf: Date = new Date(),
    options: { requireAssignment?: boolean } = {}
): Promise<{ valid: boolean; reason?: string }> {
    const card = await prisma.fuelCard.findUnique({
        where: { id: fuelCardId },
        select: { id: true, isActive: true, cardNumber: true },
    });

    if (!card) {
        return { valid: false, reason: 'Карта не найдена' };
    }

    if (!card.isActive) {
        return { valid: false, reason: 'Карта неактивна' };
    }

    // If assignment check is required
    if (options.requireAssignment !== false) {
        const assignment = await getActiveAssignment(fuelCardId, asOf);
        if (!assignment) {
            return { valid: false, reason: 'Нет активного назначения на указанную дату' };
        }
    }

    return { valid: true };
}

/**
 * Get all fuel cards valid for a driver at a specific date
 */
export async function getValidCardsForDriver(
    driverId: string,
    asOf: Date = new Date()
) {
    const assignments = await prisma.fuelCardAssignment.findMany({
        where: {
            driverId,
            validFrom: { lte: asOf },
            OR: [
                { validTo: null },
                { validTo: { gte: asOf } },
            ],
        },
        include: {
            fuelCard: {
                select: {
                    id: true,
                    cardNumber: true,
                    provider: true,
                    isActive: true,
                    balanceLiters: true,
                },
            },
        },
    });

    // Filter only active cards
    return assignments
        .filter(a => a.fuelCard.isActive)
        .map(a => ({
            ...a.fuelCard,
            assignmentId: a.id,
            validFrom: a.validFrom,
            validTo: a.validTo,
        }));
}

// ============================================================================
// Assignment CRUD
// ============================================================================

export interface CreateAssignmentData {
    fuelCardId: string;
    validFrom: Date;
    validTo?: Date;
    driverId?: string;
    vehicleId?: string;
    providerName?: string;
    comment?: string;
}

/**
 * Create a new assignment for a fuel card
 */
export async function createAssignment(data: CreateAssignmentData) {
    return prisma.fuelCardAssignment.create({
        data: {
            fuelCardId: data.fuelCardId,
            validFrom: data.validFrom,
            validTo: data.validTo,
            driverId: data.driverId,
            vehicleId: data.vehicleId,
            providerName: data.providerName,
            comment: data.comment,
        },
        include: {
            fuelCard: true,
            driver: { include: { employee: true } },
            vehicle: true,
        },
    });
}

/**
 * End an existing assignment at a specific date
 */
export async function endAssignment(assignmentId: string, endDate: Date) {
    return prisma.fuelCardAssignment.update({
        where: { id: assignmentId },
        data: { validTo: endDate },
    });
}

/**
 * Get assignment history for a fuel card
 */
export async function getAssignmentHistory(fuelCardId: string) {
    return prisma.fuelCardAssignment.findMany({
        where: { fuelCardId },
        include: {
            driver: { include: { employee: true } },
            vehicle: true,
        },
        orderBy: { validFrom: 'desc' },
    });
}

/**
 * Get all assignments for a driver (including historical)
 */
export async function getDriverAssignmentHistory(driverId: string) {
    return prisma.fuelCardAssignment.findMany({
        where: { driverId },
        include: {
            fuelCard: true,
        },
        orderBy: { validFrom: 'desc' },
    });
}

// ============================================================================
// Provider Switch Operation
// ============================================================================

export interface ProviderSwitchParams {
    organizationId: string;
    switchAt: Date;
    oldProvider: string;
    newProvider?: string;
    resetBalances?: boolean;
    newCards?: Array<{
        cardNumber: string;
        driverId?: string;
        vehicleId?: string;
    }>;
}

/**
 * Switch provider: deactivate old cards, optionally create new ones
 */
export async function switchProvider(params: ProviderSwitchParams) {
    const {
        organizationId,
        switchAt,
        oldProvider,
        newProvider,
        resetBalances = false,
        newCards = [],
    } = params;

    return prisma.$transaction(async (tx) => {
        const result = {
            deactivatedCards: 0,
            endedAssignments: 0,
            createdCards: 0,
            createdAssignments: 0,
        };

        // 1. Find old cards by provider
        const oldCards = await tx.fuelCard.findMany({
            where: {
                organizationId,
                provider: oldProvider,
                isActive: true,
            },
            include: { assignments: true },
        });

        // 2. End active assignments and deactivate cards
        for (const card of oldCards) {
            // End all active assignments
            for (const assignment of card.assignments) {
                if (!assignment.validTo || assignment.validTo > switchAt) {
                    await tx.fuelCardAssignment.update({
                        where: { id: assignment.id },
                        data: { validTo: switchAt },
                    });
                    result.endedAssignments++;
                }
            }

            // Deactivate card
            await tx.fuelCard.update({
                where: { id: card.id },
                data: { isActive: false },
            });
            result.deactivatedCards++;
        }

        // 3. Create new cards if provided
        for (const newCard of newCards) {
            const createdCard = await tx.fuelCard.create({
                data: {
                    organizationId,
                    cardNumber: newCard.cardNumber,
                    provider: newProvider,
                    isActive: true,
                    balanceLiters: 0,
                },
            });
            result.createdCards++;

            // Create assignment if driver/vehicle specified
            if (newCard.driverId || newCard.vehicleId) {
                await tx.fuelCardAssignment.create({
                    data: {
                        fuelCardId: createdCard.id,
                        validFrom: switchAt,
                        driverId: newCard.driverId,
                        vehicleId: newCard.vehicleId,
                        providerName: newProvider,
                        comment: `Создано при смене поставщика с ${oldProvider}`,
                    },
                });
                result.createdAssignments++;
            }
        }

        console.log(`[REL-106] Provider switch from ${oldProvider} to ${newProvider}: `, result);
        return result;
    });
}
