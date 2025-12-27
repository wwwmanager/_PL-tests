/**
 * REL-105: Fuel Card Reset Service
 * 
 * Handles fuel card balance resets (quarterly/monthly).
 * Modes:
 * - TRANSFER_TO_WAREHOUSE: Returns balance to warehouse pool
 * - EXPIRE_EXPENSE: Writes off balance as expense (expiration)
 */
import { PrismaClient, ResetMode, ResetScope, ResetFrequency, StockMovementType } from '@prisma/client';
import { getOrCreateFuelCardLocation, getOrCreateDefaultWarehouseLocation } from './stockLocationService';
import { getBalanceAt, createTransfer, createExpenseMovement } from './stockService';

const prisma = new PrismaClient();

export interface ResetResult {
    processed: number;
    reset: number;
    skipped: number;  // cards with zero balance
    errors: string[];
}

export interface RunResetsOptions {
    organizationId: string;
    resetAtUtc?: Date;
    ruleId?: string;  // optional: run specific rule only
    dryRun?: boolean; // preview mode
}

/**
 * Get next run date based on frequency
 */
function computeNextResetAt(now: Date, frequency: ResetFrequency): Date | null {
    const d = new Date(now);

    switch (frequency) {
        case 'MONTHLY':
            d.setUTCMonth(d.getUTCMonth() + 1);
            d.setUTCDate(1);
            d.setUTCHours(0, 0, 0, 0);
            return d;
        case 'QUARTERLY':
            const quarter = Math.floor(d.getUTCMonth() / 3);
            d.setUTCMonth((quarter + 1) * 3);
            d.setUTCDate(1);
            d.setUTCHours(0, 0, 0, 0);
            return d;
        case 'YEARLY':
            d.setUTCFullYear(d.getUTCFullYear() + 1);
            d.setUTCMonth(0);
            d.setUTCDate(1);
            d.setUTCHours(0, 0, 0, 0);
            return d;
        case 'MANUAL':
            return null;  // no automatic scheduling
    }
}

/**
 * Get period key for externalRef (for idempotency)
 */
function computePeriodKey(date: Date, frequency: ResetFrequency): string {
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth() + 1;

    switch (frequency) {
        case 'MONTHLY':
            return `${y}-${String(m).padStart(2, '0')}`;
        case 'QUARTERLY':
            const q = Math.floor((m - 1) / 3) + 1;
            return `${y}-Q${q}`;
        case 'YEARLY':
            return `${y}`;
        case 'MANUAL':
            return date.toISOString().slice(0, 10);
    }
}

/**
 * Get fuel cards matching the reset rule scope
 */
async function getCardsForRule(
    organizationId: string,
    scope: ResetScope,
    providerFilter: string | null,
    departmentId: string | null,
    cardIds: string[]
): Promise<Array<{ id: string; balanceLiters: number }>> {
    const where: any = {
        organizationId,
        isActive: true,
    };

    switch (scope) {
        case 'ALL_CARDS':
            // All active cards
            break;
        case 'BY_PROVIDER':
            if (providerFilter) {
                where.provider = providerFilter;
            }
            break;
        case 'BY_DEPARTMENT':
            if (departmentId) {
                // Find vehicles in department, then their assigned cards
                const vehicles = await prisma.vehicle.findMany({
                    where: { departmentId },
                    select: { id: true }
                });
                const vehicleIds = vehicles.map(v => v.id);
                where.assignedToVehicleId = { in: vehicleIds };
            }
            break;
        case 'SPECIFIC_CARDS':
            if (cardIds.length > 0) {
                where.id = { in: cardIds };
            } else {
                return []; // No cards specified
            }
            break;
    }

    const cards = await prisma.fuelCard.findMany({
        where,
        select: {
            id: true,
            balanceLiters: true,
        },
    });

    return cards.map(c => ({
        id: c.id,
        balanceLiters: Number(c.balanceLiters),
    }));
}

/**
 * Run fuel card resets based on configured rules
 */
export async function runResets(options: RunResetsOptions): Promise<ResetResult> {
    const { organizationId, resetAtUtc = new Date(), ruleId, dryRun = false } = options;
    const result: ResetResult = { processed: 0, reset: 0, skipped: 0, errors: [] };

    try {
        // Find applicable rules
        const whereRules: any = {
            organizationId,
            isActive: true,
        };

        if (ruleId) {
            whereRules.id = ruleId;
        } else {
            // Only rules that are due
            whereRules.OR = [
                { nextRunAt: { lte: resetAtUtc } },
                { frequency: 'MANUAL' },  // Manual rules always available
            ];
        }

        const rules = await prisma.fuelCardResetRule.findMany({
            where: whereRules,
            include: {
                stockItem: true,
                targetLocation: true,
            },
        });

        for (const rule of rules) {
            try {
                const cards = await getCardsForRule(
                    organizationId,
                    rule.scope,
                    rule.providerFilter,
                    rule.departmentId,
                    rule.cardIds
                );

                const periodKey = computePeriodKey(resetAtUtc, rule.frequency);

                for (const card of cards) {
                    result.processed++;

                    try {
                        // Get actual balance from StockMovement ledger
                        const cardLocation = await getOrCreateFuelCardLocation(card.id);
                        const stockItemId = rule.stockItemId;

                        if (!stockItemId) {
                            result.skipped++;
                            continue;
                        }

                        const balance = await getBalanceAt(cardLocation.id, stockItemId, resetAtUtc);

                        if (balance <= 0) {
                            result.skipped++;
                            continue;
                        }

                        if (dryRun) {
                            result.reset++;
                            continue;
                        }

                        // externalRef for idempotency: RESET:<ruleId>:<period>:<cardId>
                        const externalRef = `RESET:${rule.id}:${periodKey}:${card.id}`;

                        if (rule.mode === 'TRANSFER_TO_WAREHOUSE') {
                            // Transfer balance back to warehouse
                            let targetLocationId: string;
                            if (rule.targetLocationId) {
                                targetLocationId = rule.targetLocationId;
                            } else {
                                // OWN-ORG-DEPT-RESET-030: Get departmentId from card's vehicle/driver
                                const cardWithDept = await prisma.fuelCard.findUnique({
                                    where: { id: card.id },
                                    include: {
                                        assignedToVehicle: { select: { departmentId: true } },
                                        assignedToDriver: { include: { employee: { select: { departmentId: true } } } }
                                    }
                                });
                                const cardDeptId = cardWithDept?.assignedToVehicle?.departmentId
                                    || cardWithDept?.assignedToDriver?.employee?.departmentId
                                    || null;

                                const warehouseLocation = await getOrCreateDefaultWarehouseLocation(organizationId, cardDeptId);
                                targetLocationId = warehouseLocation.id;
                            }

                            await createTransfer({
                                organizationId,
                                stockItemId,
                                quantity: balance,
                                fromLocationId: cardLocation.id,
                                toLocationId: targetLocationId,
                                occurredAt: resetAtUtc,
                                occurredSeq: 10,  // Early in the day
                                documentType: 'FUEL_CARD_RESET',
                                documentId: rule.id,
                                externalRef,
                                comment: `Обнуление карты (правило: ${rule.name})`,
                            });

                            console.log(`[REL-105] TRANSFER created: ${balance}L from card ${card.id} to ${targetLocationId}`);
                        } else {
                            // EXPIRE_EXPENSE: Write off as expense
                            await createExpenseMovement(
                                organizationId,
                                stockItemId,
                                balance,
                                'FUEL_CARD_RESET',
                                rule.id,
                                undefined,  // no user (auto)
                                null,  // warehouseId deprecated
                                `Сгорание остатка карты (правило: ${rule.name})`,
                                cardLocation.id,
                                resetAtUtc
                            );

                            console.log(`[REL-105] EXPENSE created: ${balance}L from card ${card.id} (expired)`);
                        }

                        // Update FuelCard.balanceLiters to 0
                        await prisma.fuelCard.update({
                            where: { id: card.id },
                            data: { balanceLiters: 0 },
                        });

                        result.reset++;
                    } catch (cardErr: any) {
                        // Check if externalRef already exists (idempotency)
                        if (cardErr?.code === 'P2002') {
                            result.skipped++;  // Already processed
                        } else {
                            result.errors.push(`Card ${card.id}: ${cardErr.message}`);
                        }
                    }
                }

                // Update rule's lastRunAt and nextRunAt
                if (!dryRun) {
                    const nextRunAt = computeNextResetAt(resetAtUtc, rule.frequency);
                    await prisma.fuelCardResetRule.update({
                        where: { id: rule.id },
                        data: {
                            lastRunAt: resetAtUtc,
                            nextRunAt,
                        },
                    });
                }
            } catch (ruleErr: any) {
                result.errors.push(`Rule ${rule.id}: ${ruleErr.message}`);
            }
        }
    } catch (e: any) {
        result.errors.push(`Reset error: ${e.message}`);
    }

    console.log(`[FuelCardReset] Processed: ${result.processed}, Reset: ${result.reset}, Skipped: ${result.skipped}`);
    return result;
}

/**
 * Preview what would be reset without making changes
 */
export async function previewResets(options: RunResetsOptions): Promise<ResetResult> {
    return runResets({ ...options, dryRun: true });
}

/**
 * CRUD operations for reset rules
 */
export async function getResetRules(organizationId: string) {
    return prisma.fuelCardResetRule.findMany({
        where: { organizationId },
        include: {
            department: true,
            targetLocation: true,
            stockItem: true,
        },
        orderBy: { createdAt: 'desc' },
    });
}

export async function getResetRule(organizationId: string, id: string) {
    return prisma.fuelCardResetRule.findFirst({
        where: { id, organizationId },
        include: {
            department: true,
            targetLocation: true,
            stockItem: true,
        },
    });
}

export interface CreateResetRuleData {
    name: string;
    frequency: ResetFrequency;
    scope?: ResetScope;
    providerFilter?: string;
    departmentId?: string;
    cardIds?: string[];
    mode?: ResetMode;
    targetLocationId?: string;
    stockItemId?: string;
    isActive?: boolean;
}

export async function createResetRule(organizationId: string, data: CreateResetRuleData) {
    const now = new Date();
    const nextRunAt = computeNextResetAt(now, data.frequency);

    return prisma.fuelCardResetRule.create({
        data: {
            organizationId,
            name: data.name,
            frequency: data.frequency,
            scope: data.scope || 'ALL_CARDS',
            providerFilter: data.providerFilter,
            departmentId: data.departmentId,
            cardIds: data.cardIds || [],
            mode: data.mode || 'EXPIRE_EXPENSE',
            targetLocationId: data.targetLocationId,
            stockItemId: data.stockItemId,
            isActive: data.isActive ?? true,
            nextRunAt,
        },
    });
}

export async function updateResetRule(organizationId: string, id: string, data: Partial<CreateResetRuleData>) {
    const rule = await prisma.fuelCardResetRule.findFirst({
        where: { id, organizationId },
    });

    if (!rule) return null;

    // Recalculate nextRunAt if frequency changed
    let nextRunAt = rule.nextRunAt;
    if (data.frequency && data.frequency !== rule.frequency) {
        nextRunAt = computeNextResetAt(new Date(), data.frequency);
    }

    return prisma.fuelCardResetRule.update({
        where: { id },
        data: {
            name: data.name,
            frequency: data.frequency,
            scope: data.scope,
            providerFilter: data.providerFilter,
            departmentId: data.departmentId,
            cardIds: data.cardIds,
            mode: data.mode,
            targetLocationId: data.targetLocationId,
            stockItemId: data.stockItemId,
            isActive: data.isActive,
            nextRunAt,
        },
    });
}

export async function deleteResetRule(organizationId: string, id: string) {
    const rule = await prisma.fuelCardResetRule.findFirst({
        where: { id, organizationId },
    });

    if (!rule) return null;

    return prisma.fuelCardResetRule.delete({
        where: { id },
    });
}
