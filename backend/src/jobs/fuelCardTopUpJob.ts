/**
 * FUEL-001: Fuel Card Auto Top-Up Worker
 * 
 * Runs periodically to process due top-up rules.
 * Uses FOR UPDATE SKIP LOCKED to prevent duplicate processing.
 * PeriodKey unique constraint ensures idempotency.
 */
import { PrismaClient, Prisma, FuelCardTransactionType, TopUpScheduleType } from "@prisma/client";

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
            const rules = await tx.$queryRaw<
                Array<{
                    id: string;
                    organizationId: string;
                    fuelCardId: string;
                    scheduleType: TopUpScheduleType;
                    amountLiters: string;
                    minBalanceLiters: string | null;
                    timezone: string;
                }>
            >(Prisma.sql`
        SELECT "id", "organizationId", "fuelCardId", "scheduleType",
               "amountLiters"::text, "minBalanceLiters"::text, "timezone"
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

                        // Increment balance
                        await tx.fuelCard.update({
                            where: { id: r.fuelCardId },
                            data: { balanceLiters: { increment: new Prisma.Decimal(r.amountLiters) } },
                        });

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
