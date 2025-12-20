/**
 * FUEL-001: Fuel Card Auto Top-Up Worker
 * REL-104: Integrated with StockMovement TRANSFER
 * 
 * Runs periodically to process due top-up rules.
 * Uses FOR UPDATE SKIP LOCKED to prevent duplicate processing.
 * PeriodKey unique constraint ensures idempotency.
 * Creates TRANSFER (source location → fuel card location) for stock tracking.
 */
import { PrismaClient, Prisma, FuelCardTransactionType, TopUpScheduleType, StockMovementType } from "@prisma/client";
import { getOrCreateFuelCardLocation, getOrCreateDefaultWarehouseLocation } from "../services/stockLocationService";
import { createTransfer } from "../services/stockService";

const prisma = new PrismaClient();

// YYYY-MM-DD in given timezone (for DAILY)
function formatLocalDateKey(d: Date, timeZone: string): string {
    return new Intl.DateTimeFormat("sv-SE", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function formatMonthKey(d: Date, timeZone: string): string {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit" }).formatToParts(d);
    const y = parts.find(p => p.type === "year")?.value ?? "0000";
    const m = parts.find(p => p.type === "month")?.value ?? "00";
    return `${y}-${m}`;
}

// ISO week key: YYYY-Www
function isoWeekKeyFromLocalYMD(y: number, m: number, d: number): string {
    const date = new Date(Date.UTC(y, m - 1, d));
    const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0..Sun=6
    date.setUTCDate(date.getUTCDate() - dayNum + 3); // Thursday
    const isoYear = date.getUTCFullYear();
    const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
    const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
    firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
    const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
    const ww = String(week).padStart(2, "0");
    return `${isoYear}-W${ww}`;
}

function formatWeekKey(d: Date, timeZone: string): string {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
    const y = Number(parts.find(p => p.type === "year")?.value);
    const m = Number(parts.find(p => p.type === "month")?.value);
    const dd = Number(parts.find(p => p.type === "day")?.value);
    return isoWeekKeyFromLocalYMD(y, m, dd);
}

function computePeriodKey(now: Date, scheduleType: TopUpScheduleType, timeZone: string): string {
    switch (scheduleType) {
        case "DAILY": return formatLocalDateKey(now, timeZone);
        case "WEEKLY": return formatWeekKey(now, timeZone);
        case "MONTHLY": return formatMonthKey(now, timeZone);
    }
}

function computeNextRunAt(now: Date, scheduleType: TopUpScheduleType): Date {
    const d = new Date(now);
    if (scheduleType === "DAILY") d.setUTCDate(d.getUTCDate() + 1);
    if (scheduleType === "WEEKLY") d.setUTCDate(d.getUTCDate() + 7);
    if (scheduleType === "MONTHLY") d.setUTCMonth(d.getUTCMonth() + 1);
    return d;
}

export interface TopUpResult {
    processed: number;
    toppedUp: number;
    skipped: number;
    errors: string[];
}

export async function runFuelCardTopUps(batchSize = 50): Promise<TopUpResult> {
    const now = new Date();
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
                }>
            >(Prisma.sql`
        SELECT "id", "organizationId", "fuelCardId", "scheduleType",
               "amountLiters"::text, "minBalanceLiters"::text, "timezone",
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
                    const periodKey = computePeriodKey(now, r.scheduleType, r.timezone);

                    const card = await tx.fuelCard.findFirst({
                        where: { id: r.fuelCardId, organizationId: r.organizationId, isActive: true },
                        select: { id: true, balanceLiters: true },
                    });

                    if (!card) {
                        // Card deleted/inactive - advance nextRunAt
                        await tx.fuelCardTopUpRule.update({
                            where: { id: r.id },
                            data: { lastRunAt: now, nextRunAt: computeNextRunAt(now, r.scheduleType) },
                        });
                        result.skipped++;
                        continue;
                    }

                    const minBal = r.minBalanceLiters ? new Prisma.Decimal(r.minBalanceLiters) : null;
                    if (minBal && card.balanceLiters.greaterThanOrEqualTo(minBal)) {
                        // Threshold not met - skip
                        await tx.fuelCardTopUpRule.update({
                            where: { id: r.id },
                            data: { lastRunAt: now, nextRunAt: computeNextRunAt(now, r.scheduleType) },
                        });
                        result.skipped++;
                        continue;
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

                        // Increment balance on FuelCard
                        await tx.fuelCard.update({
                            where: { id: r.fuelCardId },
                            data: { balanceLiters: { increment: new Prisma.Decimal(r.amountLiters) } },
                        });

                        // REL-104: Create TRANSFER (source → fuel card) if stockItemId configured
                        if (r.stockItemId) {
                            try {
                                // Get fuel card location
                                const cardLocation = await getOrCreateFuelCardLocation(r.fuelCardId);

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
                                    stockItemId: r.stockItemId,
                                    quantity: Number(r.amountLiters),
                                    fromLocationId: sourceLocationId,
                                    toLocationId: cardLocation.id,
                                    occurredAt: now,
                                    occurredSeq: 20,  // After manual operations
                                    documentType: "FUEL_CARD_TOPUP",
                                    documentId: r.id,  // Reference to rule
                                    externalRef,
                                    comment: `Автопополнение карты (правило ${r.id})`,
                                });

                                console.log(`[REL-104] TRANSFER created: ${r.amountLiters}L to card ${r.fuelCardId}, externalRef: ${externalRef}`);
                            } catch (transferErr: any) {
                                // Log but don't fail the top-up if TRANSFER fails
                                console.error(`[REL-104] Failed to create TRANSFER for rule ${r.id}: ${transferErr.message}`);
                                result.errors.push(`TRANSFER failed for rule ${r.id}: ${transferErr.message}`);
                            }
                        }

                        result.toppedUp++;
                    } catch (e: any) {
                        // Unique violation = already topped up this period
                        if (e?.code !== "P2002") throw e;
                        result.skipped++;
                    }

                    await tx.fuelCardTopUpRule.update({
                        where: { id: r.id },
                        data: { lastRunAt: now, nextRunAt: computeNextRunAt(now, r.scheduleType) },
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

