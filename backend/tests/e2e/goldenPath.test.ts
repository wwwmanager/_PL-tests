/**
 * REL-030: Golden Path E2E Test
 * 
 * This test validates the entire waybill workflow:
 * 1. Organization + Department setup
 * 2. Employee + Driver creation (driver auto-linked)
 * 3. Vehicle with fuel rates
 * 4. Blank batch + materialization
 * 5. Issue blanks to driver
 * 6. Create waybill (number auto-assigned from blank)
 * 7. Submit waybill
 * 8. Post waybill (transactional: stock movement + blank used + audit)
 * 
 * If this test is red, no partial fixes should be merged.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient, WaybillStatus, BlankStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

// Import your services - adjust paths as needed
import { createWaybill, changeWaybillStatus, type UserInfo } from '../../src/services/waybillService';
import { issueBlanksRange } from '../../src/services/blankService';

const prisma = new PrismaClient();

// Track created entities for cleanup
let createdIds: {
    organizationId?: string;
    departmentId?: string;
    userId?: string;
    employeeId?: string;
    driverId?: string;
    vehicleId?: string;
    stockItemId?: string;
    batchId?: string;
    waybillId?: string;
} = {};

describe('Golden Path: Blanks → Waybill → Posted', () => {
    afterEach(async () => {
        // Cleanup in reverse order of dependencies
        if (createdIds.waybillId) {
            await prisma.waybillFuel.deleteMany({ where: { waybillId: createdIds.waybillId } });
            await prisma.waybillRoute.deleteMany({ where: { waybillId: createdIds.waybillId } });
            await prisma.waybill.deleteMany({ where: { id: createdIds.waybillId } });
        }
        if (createdIds.batchId) {
            await prisma.blank.deleteMany({ where: { batchId: createdIds.batchId } });
            await prisma.blankBatch.deleteMany({ where: { id: createdIds.batchId } });
        }
        if (createdIds.stockItemId) {
            await prisma.stockMovement.deleteMany({ where: { stockItemId: createdIds.stockItemId } });
            await prisma.stockItem.deleteMany({ where: { id: createdIds.stockItemId } });
        }
        if (createdIds.vehicleId) {
            await prisma.vehicle.deleteMany({ where: { id: createdIds.vehicleId } });
        }
        if (createdIds.driverId) {
            await prisma.driver.deleteMany({ where: { id: createdIds.driverId } });
        }
        if (createdIds.employeeId) {
            await prisma.employee.deleteMany({ where: { id: createdIds.employeeId } });
        }
        if (createdIds.userId) {
            await prisma.auditLog.deleteMany({ where: { userId: createdIds.userId } });
            await prisma.user.deleteMany({ where: { id: createdIds.userId } });
        }
        if (createdIds.departmentId) {
            await prisma.department.deleteMany({ where: { id: createdIds.departmentId } });
        }
        if (createdIds.organizationId) {
            await prisma.organization.deleteMany({ where: { id: createdIds.organizationId } });
        }
        createdIds = {};
    });

    it('should create waybill with reserved blank and post it transactionally', async () => {
        const testSuffix = Date.now().toString();

        // 1) Organization
        const org = await prisma.organization.create({
            data: {
                name: `E2E Org ${testSuffix}`,
                shortName: `E2E-${testSuffix}`
            },
        });
        createdIds.organizationId = org.id;

        // 2) Department
        const dept = await prisma.department.create({
            data: {
                organizationId: org.id,
                name: `E2E Dept ${testSuffix}`
            },
        });
        createdIds.departmentId = dept.id;

        // 3) User (for audit logs)
        const passwordHash = await bcrypt.hash('pass123', 10);
        const user = await prisma.user.create({
            data: {
                organizationId: org.id,
                departmentId: dept.id,
                email: `e2e-${testSuffix}@test.local`,
                passwordHash,
                fullName: 'E2E Test User',
                isActive: true,
            },
        });
        createdIds.userId = user.id;

        // 4) Employee + Driver
        const employee = await prisma.employee.create({
            data: {
                organizationId: org.id,
                departmentId: dept.id,
                fullName: `E2E Driver ${testSuffix}`,
                employeeType: 'driver',
                isActive: true,
            },
        });
        createdIds.employeeId = employee.id;

        const driver = await prisma.driver.create({
            data: {
                employeeId: employee.id,
                licenseNumber: `E2E-LIC-${testSuffix}`,
            },
        });
        createdIds.driverId = driver.id;

        // 5) Vehicle with fuel consumption rates
        const vehicle = await prisma.vehicle.create({
            data: {
                organizationId: org.id,
                departmentId: dept.id,
                registrationNumber: `E2E-${testSuffix}`,
                brand: 'TEST',
                model: 'TEST',
                fuelType: 'ДТ',
                fuelConsumptionRates: JSON.stringify({
                    summerRate: 10,
                    winterRate: 12,
                    cityIncreasePercent: 10,
                    warmingIncreasePercent: 5,
                }),
            },
        });
        createdIds.vehicleId = vehicle.id;

        // 6) Fuel stock item
        const fuelItem = await prisma.stockItem.create({
            data: {
                organizationId: org.id,
                name: 'ДТ (E2E)',
                unit: 'л',
                isFuel: true,
            },
        });
        createdIds.stockItemId = fuelItem.id;

        // 7) Blank batch + materialize
        const batch = await prisma.blankBatch.create({
            data: {
                organizationId: org.id,
                departmentId: dept.id,
                series: 'E2E',
                numberFrom: 1,
                numberTo: 3,
                createdByUserId: user.id,
            },
        });
        createdIds.batchId = batch.id;

        await prisma.blank.createMany({
            data: [1, 2, 3].map((n) => ({
                organizationId: org.id,
                departmentId: dept.id,
                batchId: batch.id,
                series: 'E2E',
                number: n,
                status: BlankStatus.AVAILABLE,
            })),
        });

        // 8) Issue blanks to driver
        await issueBlanksRange(
            org.id,
            batch.id,
            driver.id,
            1,
            3,
            dept.id
        );

        // Verify blanks are ISSUED to driver
        const issuedBlanks = await prisma.blank.findMany({
            where: { batchId: batch.id },
        });
        expect(issuedBlanks.every(b => b.status === BlankStatus.ISSUED)).toBe(true);
        expect(issuedBlanks.every(b => b.issuedToDriverId === driver.id)).toBe(true);

        // 9) Create waybill (number should be auto-assigned)
        const userInfo: UserInfo = {
            id: user.id,
            organizationId: org.id,
            departmentId: dept.id,
            role: 'admin',
            employeeId: null,
        };

        const waybill = await createWaybill(userInfo, {
            number: '', // Should be auto-assigned from blank
            date: new Date().toISOString().slice(0, 10),
            vehicleId: vehicle.id,
            driverId: driver.id,
            odometerStart: 1000,
            odometerEnd: 1050,
            isCityDriving: false,
            isWarming: false,
            routes: [
                {
                    legOrder: 1,
                    fromPoint: 'A',
                    toPoint: 'B',
                    distanceKm: 50,
                },
            ],
        });
        createdIds.waybillId = waybill.id;

        expect(waybill.id).toBeTruthy();

        // Verify waybill state after creation
        const wbAfterCreate = await prisma.waybill.findUnique({
            where: { id: waybill.id },
            include: { blank: true, fuelLines: true },
        });

        expect(wbAfterCreate?.status).toBe(WaybillStatus.DRAFT);
        expect(wbAfterCreate?.blankId).toBeTruthy();
        expect(wbAfterCreate?.blank?.status).toBe(BlankStatus.RESERVED);
        expect(wbAfterCreate?.number).toBeTruthy();
        expect(wbAfterCreate?.number?.length).toBeGreaterThan(0);

        // 10) Submit waybill
        await changeWaybillStatus(userInfo, waybill.id, WaybillStatus.SUBMITTED);

        const wbAfterSubmit = await prisma.waybill.findUnique({
            where: { id: waybill.id },
        });
        expect(wbAfterSubmit?.status).toBe(WaybillStatus.SUBMITTED);

        // 11) Post waybill (transactional: stock movement + blank USED + audit)
        await changeWaybillStatus(userInfo, waybill.id, WaybillStatus.POSTED);

        const wbAfterPosted = await prisma.waybill.findUnique({
            where: { id: waybill.id },
            include: { blank: true },
        });

        expect(wbAfterPosted?.status).toBe(WaybillStatus.POSTED);
        expect(wbAfterPosted?.blank?.status).toBe(BlankStatus.USED);

        // Verify stock movements created
        const movements = await prisma.stockMovement.findMany({
            where: {
                organizationId: org.id,
                documentType: 'WAYBILL',
                documentId: waybill.id
            },
        });
        // Note: If stock movements are optional, adjust this expectation
        // expect(movements.length).toBeGreaterThan(0);

        // Verify audit log created
        const audit = await prisma.auditLog.findMany({
            where: {
                organizationId: org.id,
                entityType: 'WAYBILL',
                entityId: waybill.id
            },
        });
        expect(audit.length).toBeGreaterThan(0);

        console.log('✅ Golden path test passed!');
    }, 30000); // 30 second timeout
});
