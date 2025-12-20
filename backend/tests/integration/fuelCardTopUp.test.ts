/**
 * FUEL-TEST-001: Integration tests for fuel card auto top-up idempotency
 * 
 * Verifies that running the top-up job twice in the same period results in exactly one top-up.
 * The unique constraint on [organizationId, fuelCardId, type, periodKey] protects against duplicates.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient, TopUpScheduleType, FuelCardTransactionType } from '@prisma/client';
import { runFuelCardTopUps } from '../../src/jobs/fuelCardTopUpJob';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { createApp } from '../../src/app';

const prisma = new PrismaClient();

describe('FUEL-TEST-001: Idempotency of fuel card auto top-up', () => {
    let testOrgId: string;
    let testDeptId: string;
    let testFuelCardId: string;
    let testTopUpRuleId: string;

    const TOP_UP_AMOUNT = 10; // liters

    beforeAll(async () => {
        // Step 1: Create test organization
        const org = await prisma.organization.create({
            data: {
                name: 'Test Org for FuelCard TopUp',
                status: 'Active'
            }
        });
        testOrgId = org.id;

        // Step 2: Create test department
        const dept = await prisma.department.create({
            data: {
                organizationId: testOrgId,
                name: 'Test Dept for FuelCard TopUp'
            }
        });
        testDeptId = dept.id;

        // Step 3: Create active FuelCard with balance = 0
        const fuelCard = await prisma.fuelCard.create({
            data: {
                organizationId: testOrgId,
                cardNumber: `TEST-CARD-${Date.now()}`,
                provider: 'TestProvider',
                isActive: true,
                balanceLiters: 0,
            }
        });
        testFuelCardId = fuelCard.id;

        // Step 4: Create FuelCardTopUpRule with nextRunAt <= now
        const now = new Date();
        const rule = await prisma.fuelCardTopUpRule.create({
            data: {
                organizationId: testOrgId,
                fuelCardId: testFuelCardId,
                isActive: true,
                scheduleType: TopUpScheduleType.DAILY,
                amountLiters: TOP_UP_AMOUNT,
                timezone: 'Europe/Moscow',
                nextRunAt: new Date(now.getTime() - 60000), // 1 minute ago
            }
        });
        testTopUpRuleId = rule.id;
    });

    afterAll(async () => {
        // Cleanup in correct order
        await prisma.fuelCardTransaction.deleteMany({
            where: { fuelCardId: testFuelCardId }
        });
        await prisma.fuelCardTopUpRule.deleteMany({
            where: { id: testTopUpRuleId }
        });
        await prisma.fuelCard.deleteMany({
            where: { id: testFuelCardId }
        });
        await prisma.department.deleteMany({
            where: { id: testDeptId }
        });
        await prisma.organization.deleteMany({
            where: { id: testOrgId }
        });
        await prisma.$disconnect();
    });

    it('should create exactly one TOPUP transaction when job runs twice in same period', async () => {
        // ========================================
        // ARRANGE: Verify initial state
        // ========================================
        const cardBefore = await prisma.fuelCard.findUnique({
            where: { id: testFuelCardId },
            select: { balanceLiters: true }
        });
        expect(cardBefore?.balanceLiters.toNumber()).toBe(0);

        const txCountBefore = await prisma.fuelCardTransaction.count({
            where: {
                fuelCardId: testFuelCardId,
                type: FuelCardTransactionType.TOPUP
            }
        });
        expect(txCountBefore).toBe(0);

        // ========================================
        // ACT: Run job TWICE
        // ========================================
        const result1 = await runFuelCardTopUps();
        console.log('First run result:', result1);

        const result2 = await runFuelCardTopUps();
        console.log('Second run result:', result2);

        // ========================================
        // ASSERT: Check idempotency
        // ========================================

        // 1. Should be exactly ONE TOPUP transaction
        const transactions = await prisma.fuelCardTransaction.findMany({
            where: {
                fuelCardId: testFuelCardId,
                type: FuelCardTransactionType.TOPUP
            }
        });

        expect(transactions.length).toBe(1);
        expect(transactions[0].amountLiters.toNumber()).toBe(TOP_UP_AMOUNT);
        expect(transactions[0].periodKey).toBeTruthy();
        expect(transactions[0].reason).toBe('AUTO_TOPUP');

        // 2. Balance should be increased by exactly 10, not 20
        const cardAfter = await prisma.fuelCard.findUnique({
            where: { id: testFuelCardId },
            select: { balanceLiters: true }
        });

        expect(cardAfter?.balanceLiters.toNumber()).toBe(TOP_UP_AMOUNT);

        // 3. First run should have processed 1, topped up 1
        expect(result1.processed).toBeGreaterThanOrEqual(1);
        expect(result1.toppedUp).toBeGreaterThanOrEqual(1);
        expect(result1.errors.length).toBe(0);

        // 4. Second run may process 0 (since nextRunAt moved forward)
        //    or process 1 but skip due to unique constraint (depends on timing)
        //    Either way, toppedUp should be 0 on second run
        expect(result2.toppedUp).toBe(0);
        expect(result2.errors.length).toBe(0);

        console.log('✅ Idempotency test passed: two job runs resulted in exactly one top-up');
    });

    it('should have unique periodKey preventing duplicate transactions', async () => {
        // Get the transaction created by previous test
        const transactions = await prisma.fuelCardTransaction.findMany({
            where: {
                fuelCardId: testFuelCardId,
                type: FuelCardTransactionType.TOPUP
            },
            select: {
                periodKey: true,
                organizationId: true,
                fuelCardId: true,
                type: true
            }
        });

        expect(transactions.length).toBe(1);

        const tx = transactions[0];

        // Verify that the unique constraint would prevent a duplicate
        // by checking the periodKey format (should be YYYY-MM-DD for DAILY)
        expect(tx.periodKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);

        // Attempt to create a duplicate - should fail with P2002
        let duplicateError: any = null;
        try {
            await prisma.fuelCardTransaction.create({
                data: {
                    organizationId: tx.organizationId,
                    fuelCardId: tx.fuelCardId,
                    type: tx.type,
                    amountLiters: 10,
                    reason: 'MANUAL_DUPLICATE_TEST',
                    periodKey: tx.periodKey!,
                }
            });
        } catch (e: any) {
            duplicateError = e;
        }

        expect(duplicateError).toBeTruthy();
        expect(duplicateError.code).toBe('P2002'); // Unique constraint violation

        console.log('✅ Unique constraint test passed: duplicate periodKey is rejected');
    });
});

/**
 * FUEL-TEST-002: Integration tests for minBalanceLiters threshold
 * 
 * Verifies that when balance >= minBalanceLiters, no top-up is performed.
 */
describe('FUEL-TEST-002: Threshold (minBalanceLiters) blocks top-up correctly', () => {
    let testOrgId: string;
    let testDeptId: string;
    let testFuelCardId: string;
    let testTopUpRuleId: string;

    const INITIAL_BALANCE = 50; // liters
    const TOP_UP_AMOUNT = 10;   // liters
    const MIN_BALANCE_THRESHOLD = 30; // liters

    beforeAll(async () => {
        // Step 1: Create test organization
        const org = await prisma.organization.create({
            data: {
                name: 'Test Org for Threshold Test',
                status: 'Active'
            }
        });
        testOrgId = org.id;

        // Step 2: Create test department
        const dept = await prisma.department.create({
            data: {
                organizationId: testOrgId,
                name: 'Test Dept for Threshold Test'
            }
        });
        testDeptId = dept.id;

        // Step 3: Create FuelCard with balance = 50 (above threshold of 30)
        const fuelCard = await prisma.fuelCard.create({
            data: {
                organizationId: testOrgId,
                cardNumber: `TEST-THRESH-${Date.now()}`,
                provider: 'TestProvider',
                isActive: true,
                balanceLiters: INITIAL_BALANCE,
            }
        });
        testFuelCardId = fuelCard.id;

        // Step 4: Create FuelCardTopUpRule with minBalanceLiters = 30
        const now = new Date();
        const rule = await prisma.fuelCardTopUpRule.create({
            data: {
                organizationId: testOrgId,
                fuelCardId: testFuelCardId,
                isActive: true,
                scheduleType: TopUpScheduleType.DAILY,
                amountLiters: TOP_UP_AMOUNT,
                minBalanceLiters: MIN_BALANCE_THRESHOLD,
                timezone: 'Europe/Moscow',
                nextRunAt: new Date(now.getTime() - 60000), // 1 minute ago
            }
        });
        testTopUpRuleId = rule.id;
    });

    afterAll(async () => {
        // Cleanup in correct order
        await prisma.fuelCardTransaction.deleteMany({
            where: { fuelCardId: testFuelCardId }
        });
        await prisma.fuelCardTopUpRule.deleteMany({
            where: { id: testTopUpRuleId }
        });
        await prisma.fuelCard.deleteMany({
            where: { id: testFuelCardId }
        });
        await prisma.department.deleteMany({
            where: { id: testDeptId }
        });
        await prisma.organization.deleteMany({
            where: { id: testOrgId }
        });
        await prisma.$disconnect();
    });

    it('should NOT create TOPUP transaction when balance >= minBalanceLiters', async () => {
        // ========================================
        // ARRANGE: Verify initial state
        // ========================================
        const cardBefore = await prisma.fuelCard.findUnique({
            where: { id: testFuelCardId },
            select: { balanceLiters: true }
        });
        expect(cardBefore?.balanceLiters.toNumber()).toBe(INITIAL_BALANCE);

        const ruleBefore = await prisma.fuelCardTopUpRule.findUnique({
            where: { id: testTopUpRuleId },
            select: { nextRunAt: true, lastRunAt: true }
        });
        const nextRunAtBefore = ruleBefore?.nextRunAt;

        // ========================================
        // ACT: Run job
        // ========================================
        const result = await runFuelCardTopUps();
        console.log('Threshold test - job result:', result);

        // ========================================
        // ASSERT: No top-up should occur
        // ========================================

        // 1. No TOPUP transaction should be created
        const transactions = await prisma.fuelCardTransaction.findMany({
            where: {
                fuelCardId: testFuelCardId,
                type: FuelCardTransactionType.TOPUP
            }
        });
        expect(transactions.length).toBe(0);

        // 2. Balance should remain unchanged
        const cardAfter = await prisma.fuelCard.findUnique({
            where: { id: testFuelCardId },
            select: { balanceLiters: true }
        });
        expect(cardAfter?.balanceLiters.toNumber()).toBe(INITIAL_BALANCE);

        // 3. Rule should have been processed (skipped) and nextRunAt should advance
        const ruleAfter = await prisma.fuelCardTopUpRule.findUnique({
            where: { id: testTopUpRuleId },
            select: { nextRunAt: true, lastRunAt: true }
        });

        // lastRunAt should be set
        expect(ruleAfter?.lastRunAt).toBeTruthy();

        // nextRunAt should have moved forward (next day for DAILY)
        expect(ruleAfter?.nextRunAt.getTime()).toBeGreaterThan(nextRunAtBefore!.getTime());

        // 4. Job result should show processed = 1, skipped = 1, toppedUp = 0
        expect(result.processed).toBeGreaterThanOrEqual(1);
        expect(result.skipped).toBeGreaterThanOrEqual(1);
        expect(result.toppedUp).toBe(0);
        expect(result.errors.length).toBe(0);

        console.log('✅ Threshold test passed: no top-up when balance >= minBalanceLiters');
    });

    it('should create TOPUP when balance drops below threshold', async () => {
        // ========================================
        // ARRANGE: Lower the balance below threshold
        // ========================================
        await prisma.fuelCard.update({
            where: { id: testFuelCardId },
            data: { balanceLiters: 20 } // Below threshold of 30
        });

        // Reset nextRunAt to trigger the job again
        const now = new Date();
        await prisma.fuelCardTopUpRule.update({
            where: { id: testTopUpRuleId },
            data: { nextRunAt: new Date(now.getTime() - 60000) }
        });

        const cardBefore = await prisma.fuelCard.findUnique({
            where: { id: testFuelCardId },
            select: { balanceLiters: true }
        });
        expect(cardBefore?.balanceLiters.toNumber()).toBe(20);

        // ========================================
        // ACT: Run job
        // ========================================
        const result = await runFuelCardTopUps();
        console.log('Below threshold test - job result:', result);

        // ========================================
        // ASSERT: Top-up SHOULD occur now
        // ========================================

        // 1. TOPUP transaction should be created
        const transactions = await prisma.fuelCardTransaction.findMany({
            where: {
                fuelCardId: testFuelCardId,
                type: FuelCardTransactionType.TOPUP
            }
        });
        expect(transactions.length).toBe(1);
        expect(transactions[0].amountLiters.toNumber()).toBe(TOP_UP_AMOUNT);

        // 2. Balance should increase by TOP_UP_AMOUNT
        const cardAfter = await prisma.fuelCard.findUnique({
            where: { id: testFuelCardId },
            select: { balanceLiters: true }
        });
        expect(cardAfter?.balanceLiters.toNumber()).toBe(20 + TOP_UP_AMOUNT); // 30

        // 3. Job should show toppedUp = 1
        expect(result.toppedUp).toBeGreaterThanOrEqual(1);
        expect(result.errors.length).toBe(0);

        console.log('✅ Below threshold test passed: top-up created when balance < minBalanceLiters');
    });
});

/**
 * FUEL-TEST-003: Integration tests for concurrency
 * 
 * Verifies that two parallel job runs don't create duplicate transactions.
 * FOR UPDATE SKIP LOCKED + unique constraint protect against race conditions.
 */
describe('FUEL-TEST-003: Concurrency (parallel workers) without duplicates', () => {
    let testOrgId: string;
    let testDeptId: string;
    let testFuelCardId: string;
    let testTopUpRuleId: string;

    const TOP_UP_AMOUNT = 10; // liters

    beforeAll(async () => {
        // Create test organization
        const org = await prisma.organization.create({
            data: {
                name: 'Test Org for Concurrency Test',
                status: 'Active'
            }
        });
        testOrgId = org.id;

        // Create test department
        const dept = await prisma.department.create({
            data: {
                organizationId: testOrgId,
                name: 'Test Dept for Concurrency Test'
            }
        });
        testDeptId = dept.id;

        // Create FuelCard with balance = 0
        const fuelCard = await prisma.fuelCard.create({
            data: {
                organizationId: testOrgId,
                cardNumber: `TEST-CONCUR-${Date.now()}`,
                provider: 'TestProvider',
                isActive: true,
                balanceLiters: 0,
            }
        });
        testFuelCardId = fuelCard.id;

        // Create FuelCardTopUpRule
        const now = new Date();
        const rule = await prisma.fuelCardTopUpRule.create({
            data: {
                organizationId: testOrgId,
                fuelCardId: testFuelCardId,
                isActive: true,
                scheduleType: TopUpScheduleType.DAILY,
                amountLiters: TOP_UP_AMOUNT,
                timezone: 'Europe/Moscow',
                nextRunAt: new Date(now.getTime() - 60000), // due
            }
        });
        testTopUpRuleId = rule.id;
    });

    afterAll(async () => {
        await prisma.fuelCardTransaction.deleteMany({
            where: { fuelCardId: testFuelCardId }
        });
        await prisma.fuelCardTopUpRule.deleteMany({
            where: { id: testTopUpRuleId }
        });
        await prisma.fuelCard.deleteMany({
            where: { id: testFuelCardId }
        });
        await prisma.department.deleteMany({
            where: { id: testDeptId }
        });
        await prisma.organization.deleteMany({
            where: { id: testOrgId }
        });
        await prisma.$disconnect();
    });

    it('should create exactly one TOPUP when two jobs run in parallel', async () => {
        // ========================================
        // ARRANGE: Verify initial state
        // ========================================
        const cardBefore = await prisma.fuelCard.findUnique({
            where: { id: testFuelCardId },
            select: { balanceLiters: true }
        });
        expect(cardBefore?.balanceLiters.toNumber()).toBe(0);

        // ========================================
        // ACT: Run TWO jobs in PARALLEL
        // ========================================
        const [result1, result2] = await Promise.all([
            runFuelCardTopUps(),
            runFuelCardTopUps()
        ]);

        console.log('Concurrency test - result1:', result1);
        console.log('Concurrency test - result2:', result2);

        // ========================================
        // ASSERT: Only ONE transaction created
        // ========================================

        // 1. Exactly one TOPUP transaction
        const transactions = await prisma.fuelCardTransaction.findMany({
            where: {
                fuelCardId: testFuelCardId,
                type: FuelCardTransactionType.TOPUP
            }
        });
        expect(transactions.length).toBe(1);
        expect(transactions[0].amountLiters.toNumber()).toBe(TOP_UP_AMOUNT);

        // 2. Balance increased by exactly TOP_UP_AMOUNT (not doubled)
        const cardAfter = await prisma.fuelCard.findUnique({
            where: { id: testFuelCardId },
            select: { balanceLiters: true }
        });
        expect(cardAfter?.balanceLiters.toNumber()).toBe(TOP_UP_AMOUNT);

        // 3. One run should have toppedUp, the other should have skipped/processed 0
        const totalToppedUp = result1.toppedUp + result2.toppedUp;
        expect(totalToppedUp).toBe(1);

        // 4. No errors in either run
        expect(result1.errors.length).toBe(0);
        expect(result2.errors.length).toBe(0);

        // 5. nextRunAt should not go backwards
        const ruleAfter = await prisma.fuelCardTopUpRule.findUnique({
            where: { id: testTopUpRuleId },
            select: { nextRunAt: true }
        });
        expect(ruleAfter?.nextRunAt.getTime()).toBeGreaterThan(Date.now() - 60000);

        console.log('✅ Concurrency test passed: parallel runs created exactly one top-up');
    });
});

/**
 * FUEL-TEST-004: Integration tests for org-scoping
 * 
 * Verifies that top-ups are correctly scoped per organization.
 * Each org gets its own transactions, no cross-org contamination.
 */
describe('FUEL-TEST-004: Org-scoping and uniqueness per organization', () => {
    let orgAId: string;
    let orgBId: string;
    let deptAId: string;
    let deptBId: string;
    let cardAId: string;
    let cardBId: string;
    let ruleAId: string;
    let ruleBId: string;

    const TOP_UP_AMOUNT = 15; // liters

    beforeAll(async () => {
        // ========================================
        // Create Organization A
        // ========================================
        const orgA = await prisma.organization.create({
            data: {
                name: 'OrgA for Scoping Test',
                status: 'Active'
            }
        });
        orgAId = orgA.id;

        const deptA = await prisma.department.create({
            data: {
                organizationId: orgAId,
                name: 'Dept A'
            }
        });
        deptAId = deptA.id;

        const cardA = await prisma.fuelCard.create({
            data: {
                organizationId: orgAId,
                cardNumber: `ORGA-CARD-${Date.now()}`,
                provider: 'ProviderA',
                isActive: true,
                balanceLiters: 0,
            }
        });
        cardAId = cardA.id;

        const now = new Date();
        const ruleA = await prisma.fuelCardTopUpRule.create({
            data: {
                organizationId: orgAId,
                fuelCardId: cardAId,
                isActive: true,
                scheduleType: TopUpScheduleType.DAILY,
                amountLiters: TOP_UP_AMOUNT,
                timezone: 'Europe/Moscow',
                nextRunAt: new Date(now.getTime() - 60000),
            }
        });
        ruleAId = ruleA.id;

        // ========================================
        // Create Organization B
        // ========================================
        const orgB = await prisma.organization.create({
            data: {
                name: 'OrgB for Scoping Test',
                status: 'Active'
            }
        });
        orgBId = orgB.id;

        const deptB = await prisma.department.create({
            data: {
                organizationId: orgBId,
                name: 'Dept B'
            }
        });
        deptBId = deptB.id;

        const cardB = await prisma.fuelCard.create({
            data: {
                organizationId: orgBId,
                cardNumber: `ORGB-CARD-${Date.now()}`,
                provider: 'ProviderB',
                isActive: true,
                balanceLiters: 0,
            }
        });
        cardBId = cardB.id;

        const ruleB = await prisma.fuelCardTopUpRule.create({
            data: {
                organizationId: orgBId,
                fuelCardId: cardBId,
                isActive: true,
                scheduleType: TopUpScheduleType.DAILY,
                amountLiters: TOP_UP_AMOUNT,
                timezone: 'Europe/Moscow',
                nextRunAt: new Date(now.getTime() - 60000),
            }
        });
        ruleBId = ruleB.id;
    });

    afterAll(async () => {
        // Cleanup in correct order
        await prisma.fuelCardTransaction.deleteMany({
            where: { fuelCardId: { in: [cardAId, cardBId] } }
        });
        await prisma.fuelCardTopUpRule.deleteMany({
            where: { id: { in: [ruleAId, ruleBId] } }
        });
        await prisma.fuelCard.deleteMany({
            where: { id: { in: [cardAId, cardBId] } }
        });
        await prisma.department.deleteMany({
            where: { id: { in: [deptAId, deptBId] } }
        });
        await prisma.organization.deleteMany({
            where: { id: { in: [orgAId, orgBId] } }
        });
        await prisma.$disconnect();
    });

    it('should create separate TOPUP transactions for each organization', async () => {
        // ========================================
        // ARRANGE: Verify initial state
        // ========================================
        const cardABefore = await prisma.fuelCard.findUnique({
            where: { id: cardAId },
            select: { balanceLiters: true }
        });
        const cardBBefore = await prisma.fuelCard.findUnique({
            where: { id: cardBId },
            select: { balanceLiters: true }
        });
        expect(cardABefore?.balanceLiters.toNumber()).toBe(0);
        expect(cardBBefore?.balanceLiters.toNumber()).toBe(0);

        // ========================================
        // ACT: Run job once
        // ========================================
        const result = await runFuelCardTopUps();
        console.log('Org-scoping test - job result:', result);

        // ========================================
        // ASSERT: Each org gets its own transaction
        // ========================================

        // 1. OrgA should have exactly one TOPUP
        const txA = await prisma.fuelCardTransaction.findMany({
            where: {
                organizationId: orgAId,
                fuelCardId: cardAId,
                type: FuelCardTransactionType.TOPUP
            }
        });
        expect(txA.length).toBe(1);
        expect(txA[0].organizationId).toBe(orgAId);
        expect(txA[0].amountLiters.toNumber()).toBe(TOP_UP_AMOUNT);

        // 2. OrgB should have exactly one TOPUP
        const txB = await prisma.fuelCardTransaction.findMany({
            where: {
                organizationId: orgBId,
                fuelCardId: cardBId,
                type: FuelCardTransactionType.TOPUP
            }
        });
        expect(txB.length).toBe(1);
        expect(txB[0].organizationId).toBe(orgBId);
        expect(txB[0].amountLiters.toNumber()).toBe(TOP_UP_AMOUNT);

        // 3. Balances should be updated correctly
        const cardAAfter = await prisma.fuelCard.findUnique({
            where: { id: cardAId },
            select: { balanceLiters: true }
        });
        const cardBAfter = await prisma.fuelCard.findUnique({
            where: { id: cardBId },
            select: { balanceLiters: true }
        });
        expect(cardAAfter?.balanceLiters.toNumber()).toBe(TOP_UP_AMOUNT);
        expect(cardBAfter?.balanceLiters.toNumber()).toBe(TOP_UP_AMOUNT);

        // 4. No cross-org transactions
        const crossOrgTxA = await prisma.fuelCardTransaction.findMany({
            where: {
                organizationId: orgBId,
                fuelCardId: cardAId
            }
        });
        const crossOrgTxB = await prisma.fuelCardTransaction.findMany({
            where: {
                organizationId: orgAId,
                fuelCardId: cardBId
            }
        });
        expect(crossOrgTxA.length).toBe(0);
        expect(crossOrgTxB.length).toBe(0);

        // 5. Job processed 2 rules, topped up 2
        expect(result.processed).toBeGreaterThanOrEqual(2);
        expect(result.toppedUp).toBeGreaterThanOrEqual(2);
        expect(result.errors.length).toBe(0);

        console.log('✅ Org-scoping test passed: each org has its own isolated transactions');
    });

    it('should allow same periodKey in different organizations', async () => {
        // Get both transactions
        const txA = await prisma.fuelCardTransaction.findFirst({
            where: { organizationId: orgAId, fuelCardId: cardAId }
        });
        const txB = await prisma.fuelCardTransaction.findFirst({
            where: { organizationId: orgBId, fuelCardId: cardBId }
        });

        expect(txA).toBeTruthy();
        expect(txB).toBeTruthy();

        // Both should have the same periodKey (same day)
        expect(txA!.periodKey).toBe(txB!.periodKey);

        // But they are in different orgs, so unique constraint is satisfied
        expect(txA!.organizationId).not.toBe(txB!.organizationId);

        console.log('✅ PeriodKey uniqueness test passed: same periodKey allowed in different orgs');
    });
});

/**
 * FUEL-SEC-001: Security tests for RBAC on admin endpoint
 * 
 * Verifies that only admin users can access /admin/jobs/run-fuelcard-topups
 */
describe('FUEL-SEC-001: RBAC on /admin/jobs/run-fuelcard-topups', () => {
    let app: ReturnType<typeof createApp>;
    let testOrgId: string;
    let adminUserId: string;
    let dispatcherUserId: string;
    let adminToken: string;
    let dispatcherToken: string;

    const adminEmail = `admin.sec.${Date.now()}@waybills.local`;
    const dispatcherEmail = `dispatcher.sec.${Date.now()}@waybills.local`;
    const password = 'testpass123';

    beforeAll(async () => {
        app = createApp();

        // Create test org
        const org = await prisma.organization.create({
            data: { name: 'Org for RBAC Test', status: 'Active' }
        });
        testOrgId = org.id;

        // Get or create roles
        const adminRole = await prisma.role.findUnique({ where: { code: 'admin' } }) ??
            await prisma.role.create({ data: { code: 'admin', name: 'Admin' } });
        const dispatcherRole = await prisma.role.findUnique({ where: { code: 'dispatcher' } }) ??
            await prisma.role.create({ data: { code: 'dispatcher', name: 'Dispatcher' } });

        const passwordHash = await bcrypt.hash(password, 10);

        // Create admin user
        const adminUser = await prisma.user.create({
            data: {
                organizationId: testOrgId,
                email: adminEmail,
                passwordHash,
                fullName: 'Admin for RBAC Test',
                isActive: true,
            }
        });
        adminUserId = adminUser.id;
        await prisma.userRole.create({ data: { userId: adminUserId, roleId: adminRole.id } });

        // Create dispatcher user
        const dispatcherUser = await prisma.user.create({
            data: {
                organizationId: testOrgId,
                email: dispatcherEmail,
                passwordHash,
                fullName: 'Dispatcher for RBAC Test',
                isActive: true,
            }
        });
        dispatcherUserId = dispatcherUser.id;
        await prisma.userRole.create({ data: { userId: dispatcherUserId, roleId: dispatcherRole.id } });

        // Login as admin
        const adminLoginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: adminEmail, password });
        adminToken = adminLoginRes.body?.data?.token || adminLoginRes.body?.token || '';

        // Login as dispatcher
        const dispatcherLoginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: dispatcherEmail, password });
        dispatcherToken = dispatcherLoginRes.body?.data?.token || dispatcherLoginRes.body?.token || '';
    });

    afterAll(async () => {
        // Cleanup
        await prisma.refreshToken.deleteMany({ where: { userId: { in: [adminUserId, dispatcherUserId] } } });
        await prisma.userRole.deleteMany({ where: { userId: { in: [adminUserId, dispatcherUserId] } } });
        await prisma.user.deleteMany({ where: { id: { in: [adminUserId, dispatcherUserId] } } });
        await prisma.organization.deleteMany({ where: { id: testOrgId } });
        await prisma.$disconnect();
    });

    it('should allow admin to run fuel top-up job', async () => {
        const res = await request(app)
            .post('/api/admin/jobs/run-fuelcard-topups')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body).toHaveProperty('processed');
        expect(res.body).toHaveProperty('toppedUp');
        expect(res.body).toHaveProperty('durationMs');
        expect(res.body).toHaveProperty('requestId');

        console.log('✅ Admin can run fuel top-up job');
    });

    it('should deny dispatcher access with 403', async () => {
        const res = await request(app)
            .post('/api/admin/jobs/run-fuelcard-topups')
            .set('Authorization', `Bearer ${dispatcherToken}`);

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain('Access denied');

        console.log('✅ Dispatcher correctly denied with 403');
    });

    it('should deny unauthenticated access with 401', async () => {
        const res = await request(app)
            .post('/api/admin/jobs/run-fuelcard-topups');

        expect(res.status).toBe(401);

        console.log('✅ Unauthenticated request correctly denied with 401');
    });
});
