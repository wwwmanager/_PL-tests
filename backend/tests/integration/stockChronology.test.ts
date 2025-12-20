/**
 * REL-108: Chronology, Backdated Inserts, and Idempotency Tests
 * 
 * Uses test.sequential to ensure proper order execution
 */
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient, StockMovementType, StockLocationType } from '@prisma/client';

const prisma = new PrismaClient();

// Shared test context
interface TestContext {
    orgId: string;
    itemId: string;
    warehouseId: string;
    cardId: string;
}

let ctx: TestContext;

describe('REL-108: Stock Movement Chronology Tests', () => {
    beforeAll(async () => {
        console.log('[REL-108] Setting up test data...');

        const org = await prisma.organization.create({
            data: { name: 'REL-108 Test Org', status: 'Active' },
        });

        const item = await prisma.stockItem.create({
            data: {
                organizationId: org.id,
                name: 'Бензин АИ-95 (REL-108)',
                code: `AI95-${org.id.slice(0, 8)}`,
                unit: 'л',
                isFuel: true,
            },
        });

        const warehouse = await prisma.stockLocation.create({
            data: {
                organizationId: org.id,
                type: StockLocationType.WAREHOUSE,
                name: 'Тестовый склад',
            },
        });

        const card = await prisma.stockLocation.create({
            data: {
                organizationId: org.id,
                type: StockLocationType.FUEL_CARD,
                name: 'Тестовая карта',
            },
        });

        ctx = {
            orgId: org.id,
            itemId: item.id,
            warehouseId: warehouse.id,
            cardId: card.id,
        };

        console.log('[REL-108] Setup complete:', ctx.orgId);
    });

    afterAll(async () => {
        if (ctx?.orgId) {
            await prisma.stockMovement.deleteMany({ where: { organizationId: ctx.orgId } });
            await prisma.stockLocation.deleteMany({ where: { organizationId: ctx.orgId } });
            await prisma.stockItem.deleteMany({ where: { organizationId: ctx.orgId } });
            await prisma.organization.deleteMany({ where: { id: ctx.orgId } });
        }
        await prisma.$disconnect();
    });

    // Use test.sequential to ensure order
    test.sequential('should calculate balance at specific date correctly', async () => {
        // Wait for ctx to be set
        expect(ctx).toBeDefined();
        expect(ctx.orgId).toMatch(/^[0-9a-f-]{36}$/i);

        await prisma.stockMovement.deleteMany({ where: { organizationId: ctx.orgId } });

        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Income last week: +100
        await prisma.stockMovement.create({
            data: {
                organizationId: ctx.orgId,
                stockItemId: ctx.itemId,
                stockLocationId: ctx.warehouseId,
                movementType: StockMovementType.INCOME,
                quantity: 100,
                occurredAt: lastWeek,
                documentType: 'TEST',
            },
        });

        // Expense yesterday: -30
        await prisma.stockMovement.create({
            data: {
                organizationId: ctx.orgId,
                stockItemId: ctx.itemId,
                stockLocationId: ctx.warehouseId,
                movementType: StockMovementType.EXPENSE,
                quantity: 30,
                occurredAt: yesterday,
                documentType: 'TEST',
            },
        });

        // Balance at lastWeek+1s = 100
        const balanceLastWeek = await calculateBalance(ctx.warehouseId, ctx.itemId, new Date(lastWeek.getTime() + 1000));
        expect(balanceLastWeek).toBe(100);

        // Balance now = 70
        const balanceNow = await calculateBalance(ctx.warehouseId, ctx.itemId, now);
        expect(balanceNow).toBe(70);

        // Balance before = 0
        const balanceBefore = await calculateBalance(ctx.warehouseId, ctx.itemId, new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000));
        expect(balanceBefore).toBe(0);

        console.log('✅ As-of balance test passed');
    });

    test.sequential('should include TRANSFER in balance calculation', async () => {
        expect(ctx).toBeDefined();
        await prisma.stockMovement.deleteMany({ where: { organizationId: ctx.orgId } });

        const now = new Date();
        const hour = 60 * 60 * 1000;

        // Income: +50
        await prisma.stockMovement.create({
            data: {
                organizationId: ctx.orgId,
                stockItemId: ctx.itemId,
                stockLocationId: ctx.warehouseId,
                movementType: StockMovementType.INCOME,
                quantity: 50,
                occurredAt: new Date(now.getTime() - 3 * hour),
                documentType: 'TEST',
            },
        });

        // Transfer: warehouse -> card: 20
        await prisma.stockMovement.create({
            data: {
                organizationId: ctx.orgId,
                stockItemId: ctx.itemId,
                movementType: StockMovementType.TRANSFER,
                quantity: 20,
                fromStockLocationId: ctx.warehouseId,
                toStockLocationId: ctx.cardId,
                occurredAt: new Date(now.getTime() - 2 * hour),
                documentType: 'TEST',
            },
        });

        expect(await calculateBalance(ctx.warehouseId, ctx.itemId, now)).toBe(30);
        expect(await calculateBalance(ctx.cardId, ctx.itemId, now)).toBe(20);

        console.log('✅ TRANSFER balance test passed');
    });

    test.sequential('should prevent duplicate movements with same externalRef', async () => {
        expect(ctx).toBeDefined();
        await prisma.stockMovement.deleteMany({ where: { organizationId: ctx.orgId } });

        const externalRef = `TOPUP:rule-123:${Date.now()}`;

        // First - success
        await prisma.stockMovement.create({
            data: {
                organizationId: ctx.orgId,
                stockItemId: ctx.itemId,
                stockLocationId: ctx.warehouseId,
                movementType: StockMovementType.INCOME,
                quantity: 100,
                occurredAt: new Date(),
                documentType: 'TOPUP',
                externalRef,
            },
        });

        // Second with same ref - should fail
        await expect(
            prisma.stockMovement.create({
                data: {
                    organizationId: ctx.orgId,
                    stockItemId: ctx.itemId,
                    stockLocationId: ctx.warehouseId,
                    movementType: StockMovementType.INCOME,
                    quantity: 100,
                    occurredAt: new Date(),
                    documentType: 'TOPUP',
                    externalRef,
                },
            })
        ).rejects.toThrow();

        console.log('✅ externalRef idempotency test passed');
    });

    test.sequential('should allow different externalRef for different periods', async () => {
        expect(ctx).toBeDefined();
        await prisma.stockMovement.deleteMany({ where: { organizationId: ctx.orgId } });

        const ts = Date.now();

        const q1 = await prisma.stockMovement.create({
            data: {
                organizationId: ctx.orgId,
                stockItemId: ctx.itemId,
                stockLocationId: ctx.warehouseId,
                movementType: StockMovementType.INCOME,
                quantity: 100,
                occurredAt: new Date(),
                documentType: 'TOPUP',
                externalRef: `TOPUP:Q1:${ts}`,
            },
        });

        const q2 = await prisma.stockMovement.create({
            data: {
                organizationId: ctx.orgId,
                stockItemId: ctx.itemId,
                stockLocationId: ctx.warehouseId,
                movementType: StockMovementType.INCOME,
                quantity: 100,
                occurredAt: new Date(),
                documentType: 'TOPUP',
                externalRef: `TOPUP:Q2:${ts}`,
            },
        });

        expect(q1.id).not.toBe(q2.id);
        console.log('✅ Different periods test passed');
    });

    test.sequential('should order movements by occurredAt then occurredSeq', async () => {
        expect(ctx).toBeDefined();
        expect(ctx.orgId).toMatch(/^[0-9a-f-]{36}$/i);
        expect(ctx.itemId).toMatch(/^[0-9a-f-]{36}$/i);

        await prisma.stockMovement.deleteMany({ where: { organizationId: ctx.orgId } });

        const baseTime = new Date('2024-01-15T12:00:00Z');

        // Create with different seq
        await prisma.stockMovement.create({
            data: {
                organizationId: ctx.orgId,
                stockItemId: ctx.itemId,
                stockLocationId: ctx.warehouseId,
                movementType: StockMovementType.INCOME,
                quantity: 100,
                occurredAt: baseTime,
                occurredSeq: 10,
                documentType: 'TEST',
                comment: 'first',
            },
        });

        await prisma.stockMovement.create({
            data: {
                organizationId: ctx.orgId,
                stockItemId: ctx.itemId,
                stockLocationId: ctx.warehouseId,
                movementType: StockMovementType.EXPENSE,
                quantity: 30,
                occurredAt: baseTime,
                occurredSeq: 20,
                documentType: 'TEST',
                comment: 'second',
            },
        });

        await prisma.stockMovement.create({
            data: {
                organizationId: ctx.orgId,
                stockItemId: ctx.itemId,
                stockLocationId: ctx.warehouseId,
                movementType: StockMovementType.EXPENSE,
                quantity: 20,
                occurredAt: baseTime,
                occurredSeq: 15,
                documentType: 'TEST',
                comment: 'middle',
            },
        });

        const movements = await prisma.stockMovement.findMany({
            where: { organizationId: ctx.orgId },
            orderBy: [{ occurredAt: 'asc' }, { occurredSeq: 'asc' }],
        });

        expect(movements[0].comment).toBe('first');   // seq 10
        expect(movements[1].comment).toBe('middle');  // seq 15
        expect(movements[2].comment).toBe('second');  // seq 20

        console.log('✅ occurredSeq ordering test passed');
    });
});

// Helper function
async function calculateBalance(locationId: string, stockItemId: string, asOf: Date): Promise<number> {
    const [incomes, expenses, adjustments, transfersIn, transfersOut] = await Promise.all([
        prisma.stockMovement.aggregate({
            where: { stockLocationId: locationId, stockItemId, movementType: StockMovementType.INCOME, occurredAt: { lte: asOf } },
            _sum: { quantity: true },
        }),
        prisma.stockMovement.aggregate({
            where: { stockLocationId: locationId, stockItemId, movementType: StockMovementType.EXPENSE, occurredAt: { lte: asOf } },
            _sum: { quantity: true },
        }),
        prisma.stockMovement.aggregate({
            where: { stockLocationId: locationId, stockItemId, movementType: StockMovementType.ADJUSTMENT, occurredAt: { lte: asOf } },
            _sum: { quantity: true },
        }),
        prisma.stockMovement.aggregate({
            where: { toStockLocationId: locationId, stockItemId, movementType: StockMovementType.TRANSFER, occurredAt: { lte: asOf } },
            _sum: { quantity: true },
        }),
        prisma.stockMovement.aggregate({
            where: { fromStockLocationId: locationId, stockItemId, movementType: StockMovementType.TRANSFER, occurredAt: { lte: asOf } },
            _sum: { quantity: true },
        }),
    ]);

    return (
        Number(incomes._sum?.quantity || 0) -
        Number(expenses._sum?.quantity || 0) +
        Number(adjustments._sum?.quantity || 0) +
        Number(transfersIn._sum?.quantity || 0) -
        Number(transfersOut._sum?.quantity || 0)
    );
}
