// FULL TEST RESTORED - USING GLOBALS (No 'vitest' import)
// This matches the successful "Imports Isolation" setup.

import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/db/prisma';
import { signAccessToken as signJwt } from '../../src/utils/jwt';
import { BlankStatus, WaybillStatus } from '@prisma/client';

console.log('--- FILE LOADED, IMPORTS OK ---');

// describe, it, expect, beforeAll, afterAll provided by Globals

describe('E2E Golden Path: Waybill Lifecycle (Strict Driver Mode)', () => {
    console.log('--- DESCRIBE BLOCK STARTED ---');

    let app: any;
    let adminToken: string;
    let organizationId: string;
    let departmentId: string;
    let userId: string;

    let driverId: string;
    let vehicleId: string;
    let blankBatchId: string;
    let issuedBlankId: string;
    let waybillId: string;

    beforeAll(async () => {
        console.log('--- BEFORE ALL STARTED ---');
        try {
            app = createApp();
            console.log('--- APP CREATED ---');

            const org = await prisma.organization.create({
                data: {
                    name: `GoldenPath Org ${Date.now()}`,
                    status: 'Active'
                }
            });
            organizationId = org.id;

            const dept = await prisma.department.create({
                data: {
                    name: 'Transport Dept',
                    organizationId,
                    defaultWarehouseId: null
                }
            });
            departmentId = dept.id;

            const user = await prisma.user.create({
                data: {
                    email: `golden_path_${Date.now()}@example.com`,
                    roles: { create: { role: { connect: { code: 'admin' } } } },
                    organizationId,
                    departmentId,
                    passwordHash: 'hash',
                    fullName: 'Test Admin'
                }
            });
            userId = user.id;

            adminToken = signJwt({
                id: user.id,
                organizationId,
                departmentId,
                role: 'admin',
                tokenVersion: user.tokenVersion || 0
            });
            console.log('--- BEFORE ALL COMPLETED ---');
        } catch (error) {
            console.error('--- BEFORE ALL ERROR ---', error);
            throw error;
        }
    });

    afterAll(async () => {
        if (organizationId) {
            try {
                await prisma.organization.delete({ where: { id: organizationId } });
            } catch (e) {
                console.log('Cleanup error:', e);
            }
        }
    });

    it('should create prerequisites: Driver (Strict) and Vehicle', async () => {
        console.log('--- EXECUTING STEP 1 ---');
        const employee = await prisma.employee.create({
            data: {
                organizationId,
                departmentId,
                fullName: 'Иванов Иван Голденович',
                employeeType: 'driver',
                status: 'Active'
            }
        });

        let driver = await prisma.driver.findFirst({
            where: { employeeId: employee.id }
        });

        if (!driver) {
            driver = await prisma.driver.create({
                data: {
                    employeeId: employee.id,
                    licenseNumber: 'AA 123456',
                    licenseCategory: 'C'
                }
            });
        }

        driverId = driver.id;

        const vehicle = await prisma.vehicle.create({
            data: {
                organizationId,
                departmentId,
                brand: 'Kamaz',
                registrationNumber: `x${Date.now()}xx`, // Unique
                vehicleType: 'TRUCK',
                fuelConsumptionRates: { summerRate: 20 },
                isActive: true
            }
        });
        vehicleId = vehicle.id;

        expect(driverId).toBeDefined();
        expect(vehicleId).toBeDefined();
    });

    it('should handle Blank Lifecycle: Batch -> Materialize -> Issue', async () => {
        console.log('--- EXECUTING STEP 2 ---');
        const createBatchRes = await request(app)
            .post('/api/blanks/batches')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                departmentId,
                series: 'GP',
                numberFrom: 100,
                numberTo: 105
            });

        expect(createBatchRes.status).toBe(201);
        blankBatchId = createBatchRes.body.id;

        const materializeRes = await request(app)
            .post(`/api/blanks/batches/${blankBatchId}/materialize`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(materializeRes.status).toBe(200);

        const blankInDb = await prisma.blank.findFirst({
            where: { batchId: blankBatchId, number: 100 }
        });
        expect(blankInDb).not.toBeNull();

        const issueRes = await request(app)
            .post('/api/blanks/issue')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                series: 'GP',
                number: 100,
                driverId: driverId,
                vehicleId
            });

        expect(issueRes.status).toBe(200);
        issuedBlankId = blankInDb!.id;
    });

    it('should run Waybill Lifecycle: DRAFT -> POSTED', async () => {
        console.log('--- EXECUTING STEP 3 ---');
        const createRes = await request(app)
            .post('/api/waybills')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                driverId,
                vehicleId,
                departmentId,
                date: new Date().toISOString(),
                blankSeries: 'GP',
                blankNumber: 100,
                blankId: issuedBlankId,
                plannedRoute: 'Base -> Client -> Base',
                odometerStart: 1000,
                odometerEnd: 1000,
                fuelBalanceStart: 50
            });

        if (createRes.status !== 201) {
            console.log('Waybill Create Error:', JSON.stringify(createRes.body, null, 2));
        }

        expect(createRes.status).toBe(201);
        waybillId = createRes.body.id;

        const blankAfterDraft = await prisma.blank.findUnique({ where: { id: issuedBlankId } });
        expect(blankAfterDraft?.status).toBe(BlankStatus.RESERVED);

        const submitRes = await request(app)
            .patch(`/api/waybills/${waybillId}/status`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                status: WaybillStatus.SUBMITTED
            });
        expect(submitRes.status).toBe(200);

        const postRes = await request(app)
            .patch(`/api/waybills/${waybillId}/status`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                status: WaybillStatus.POSTED,
                odometerEnd: 1100
            });

        expect(postRes.status).toBe(200);

        const finalWaybill = await prisma.waybill.findUnique({ where: { id: waybillId } });
        expect(finalWaybill?.status).toBe(WaybillStatus.POSTED);

        const finalBlank = await prisma.blank.findUnique({ where: { id: issuedBlankId } });
        expect(finalBlank?.status).toBe(BlankStatus.USED);
    });
});
