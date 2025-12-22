/**
 * FUEL-001: Fuel Card Auto Top-Up Worker
 * REL-104: Integrated with StockMovement TRANSFER
 * FUEL-TOPUP-005: Ledger is source of truth (no balanceLiters double-accounting)
 * 
 * Runs periodically to process due top-up rules.
 * Uses FOR UPDATE SKIP LOCKED to prevent duplicate processing.
 * externalRef unique constraint ensures idempotency.
 * Creates TRANSFER (source location → fuel card location) for stock tracking.
 * occurredAt uses rule.nextRunAt for deterministic as-of calculations.
 */
import { PrismaClient, Prisma, FuelCardTransactionType, TopUpScheduleType } from "@prisma/client";
import { getOrCreateFuelCardLocation, getOrCreateDefaultWarehouseLocation } from "../services/stockLocationService";
import { createTransfer, getBalanceAt } from "../services/stockService";
import { computeNextRunAt, computePeriodKey } from "../utils/topUpUtils";

const prisma = new PrismaClient();

// Utility functions moved to ../utils/topUpUtils.ts

export interface TopUpResult {
    processed: number;
    toppedUp: number;
    skipped: number;
    errors: string[];
}

export async function runFuelCardTopUps(batchSize = 50, runAtUtc: Date = new Date()): Promise<TopUpResult> {
    const now = runAtUtc;
    const result: TopUpResult = { processed: 0, toppedUp: 0, skipped: 0, errors: [] };

    try {
        await prisma.$transaction(async (tx) => {
            // Claim due rules with SKIP LOCKED (Postgres)
            // REL-104: Added stockItemId and sourceLocationId
            const rules = await tx.$queryRaw<
                Array<{
                    id: string;
                    organizationId: string;
                    fuelCardId: string;
                    scheduleType: TopUpScheduleType;
                    amountLiters: string;
                    minBalanceLiters: string | null;
                    timezone: string;
                    stockItemId: string | null;
                    sourceLocationId: string | null;
                    nextRunAt: Date;
                }>
            >(Prisma.sql`
        SELECT "id", "organizationId", "fuelCardId", "scheduleType",
               "amountLiters"::text, "minBalanceLiters"::text, "timezone", "nextRunAt",
               "stockItemId", "sourceLocationId"
        FROM "fuel_card_topup_rules"
        WHERE "isActive" = true
          AND "nextRunAt" <= NOW()
        ORDER BY "nextRunAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${batchSize}
      `);

            for (const r of rules) {
                result.processed++;

                try {
                    // FUEL-TOPUP-005: Use rule.nextRunAt as occurredAt for deterministic as-of
                    const ruleNextRunAt = new Date(r.nextRunAt);
                    const periodKey = computePeriodKey(ruleNextRunAt, r.scheduleType, r.timezone);

                    const card = await tx.fuelCard.findFirst({
                        where: { id: r.fuelCardId, organizationId: r.organizationId, isActive: true },
                        select: { id: true },
                    });

                    if (!card) {
                        // Card deleted/inactive - advance nextRunAt from rule.nextRunAt (not now)
                        await tx.fuelCardTopUpRule.update({
                            where: { id: r.id },
                            data: { lastRunAt: now, nextRunAt: computeNextRunAt(ruleNextRunAt, r.scheduleType) },
                        });
                        result.skipped++;
                        continue;
                    }

                    // FUEL-TOPUP-005: Check threshold via ledger (not balanceLiters)
                    // Get card location for ledger balance check
                    const cardLocation = await getOrCreateFuelCardLocation(r.fuelCardId);
                    const stockItemId = r.stockItemId;

                    if (!stockItemId) {
                        // No stockItemId configured - skip with warning
                        console.warn(`[FuelCardTopUp] Rule ${r.id} has no stockItemId configured, skipping`);
                        await tx.fuelCardTopUpRule.update({
                            where: { id: r.id },
                            data: { lastRunAt: now, nextRunAt: computeNextRunAt(ruleNextRunAt, r.scheduleType) },
                        });
                        result.skipped++;
                        continue;
                    }

                    const minBal = r.minBalanceLiters ? Number(r.minBalanceLiters) : null;
                    if (minBal !== null) {
                        // FUEL-TOPUP-AUTO-030: Check balance via ledger as-of ruleNextRunAt
                        const currentBalance = await getBalanceAt(cardLocation.id, stockItemId, ruleNextRunAt);
                        if (currentBalance >= minBal) {
                            // Threshold not met - skip
                            await tx.fuelCardTopUpRule.update({
                                where: { id: r.id },
                                data: { lastRunAt: now, nextRunAt: computeNextRunAt(ruleNextRunAt, r.scheduleType) },
                            });
                            result.skipped++;
                            continue;
                        }
                    }

                    // Try to create transaction (unique constraint protects from duplicates)
                    try {
                        await tx.fuelCardTransaction.create({
                            data: {
                                organizationId: r.organizationId,
                                fuelCardId: r.fuelCardId,
                                type: FuelCardTransactionType.TOPUP,
                                amountLiters: new Prisma.Decimal(r.amountLiters),
                                reason: "AUTO_TOPUP",
                                periodKey,
                                createdByUserId: null,
                            },
                        });

                        // FUEL-TOPUP-005: NO LONGER incrementing balanceLiters
                        // Ledger (StockMovement) is the source of truth

                        // REL-104 + FUEL-TOPUP-005: Create TRANSFER (source → fuel card)
                        // This is the ledger entry that tracks the actual balance
                        try {
                            // Get source location (configured or default warehouse)
                            let sourceLocationId: string;
                            if (r.sourceLocationId) {
                                sourceLocationId = r.sourceLocationId;
                            } else {
                                const warehouseLocation = await getOrCreateDefaultWarehouseLocation(r.organizationId);
                                sourceLocationId = warehouseLocation.id;
                            }

                            // externalRef for idempotency: TOPUP:<ruleId>:<periodKey>
                            const externalRef = `TOPUP:${r.id}:${periodKey}`;

                            await createTransfer({
                                organizationId: r.organizationId,
                                stockItemId,
                                quantity: Number(r.amountLiters),
                                fromLocationId: sourceLocationId,
                                toLocationId: cardLocation.id,
                                // FUEL-TOPUP-005: Use rule.nextRunAt for deterministic as-of
                                occurredAt: ruleNextRunAt,
                                occurredSeq: 20,  // After manual operations
                                documentType: "FUEL_CARD_TOPUP",
                                documentId: r.id,  // Reference to rule
                                externalRef,
                                comment: `Автопополнение карты (правило ${r.id})`,
                            });

                            console.log(`[FUEL-TOPUP-005] TRANSFER created: ${r.amountLiters}L to card ${r.fuelCardId}, occurredAt: ${ruleNextRunAt.toISOString()}, externalRef: ${externalRef}`);
                        } catch (transferErr: any) {
                            // TRANSFER failure is now critical since it's the source of truth
                            console.error(`[FUEL-TOPUP-005] Failed to create TRANSFER for rule ${r.id}: ${transferErr.message}`);
                            result.errors.push(`TRANSFER failed for rule ${r.id}: ${transferErr.message}`);
                            throw transferErr; // Rollback the FuelCardTransaction too
                        }

                        result.toppedUp++;
                    } catch (e: any) {
                        // Unique violation = already topped up this period
                        if (e?.code !== "P2002") throw e;
                        result.skipped++;
                    }

                    // FUEL-TOPUP-005: Compute next from rule.nextRunAt to preserve intervals
                    await tx.fuelCardTopUpRule.update({
                        where: { id: r.id },
                        data: { lastRunAt: now, nextRunAt: computeNextRunAt(ruleNextRunAt, r.scheduleType) },
                    });
                } catch (e: any) {
                    result.errors.push(`Rule ${r.id}: ${e.message}`);
                }
            }
        });
    } catch (e: any) {
        result.errors.push(`Transaction error: ${e.message}`);
    }

    console.log(`[FuelCardTopUp] Processed: ${result.processed}, Topped up: ${result.toppedUp}, Skipped: ${result.skipped}`);
    return result;
}

// For cron/scheduler integration
export async function scheduledTopUpJob() {
    console.log('[FuelCardTopUp] Starting scheduled run...');
    const result = await runFuelCardTopUps();
    console.log('[FuelCardTopUp] Complete:', result);
    return result;
}

