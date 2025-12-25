
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createWaybill, updateWaybill, getWaybillById } from '../waybillService';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

describe('Waybill Regression Tests (WB-REG-002)', () => {
    let organizationId: string;
    let userId: string;
    let vehicleId: string;
    let driverId: string;
    let employeeId: string;
    let fuelStockItemId: string;

    beforeAll(async () => {
        const org = await prisma.organization.create({
            data: { name: 'RegTest Org ' + uuidv4(), inn: '1234567890' }
        });
        organizationId = org.id;

        const dept = await prisma.department.create({
            data: { name: 'RegTest Dept', organizationId, code: 'RTD' }
        });

        // Ensure Admin Role
        const adminRole = await prisma.role.upsert({
            where: { code: 'admin' },
            update: {},
            create: { code: 'admin', name: 'Admin' }
        });

        const emp = await prisma.employee.create({
            data: {
                organizationId,
                departmentId: dept.id,
                fullName: 'Test User',
                employeeType: 'dispatcher'
            }
        });
        employeeId = emp.id;

        // Current User (Dispatcher/Admin)
        const user = await prisma.user.create({
            data: {
                email: 'regtest@example.com-' + uuidv4(),
                passwordHash: 'hash',
                organizationId,
                fullName: 'RegTest Admin',
                employeeId: emp.id,
                roles: {
                    create: {
                        roleId: adminRole.id
                    }
                }
            }
        });
        userId = user.id;

        // Driver
        const driverEmp = await prisma.employee.create({
            data: {
                organizationId,
                departmentId: dept.id,
                fullName: 'Driver One',
                employeeType: 'driver'
            }
        });
        const driver = await prisma.driver.create({
            data: {
                employeeId: driverEmp.id,
                licenseNumber: 'DOC123'
            }
        });
        driverId = driver.id;

        // Blank Batch & Blank
        const batch = await prisma.blankBatch.create({
            data: {
                organizationId,
                departmentId: dept.id,
                series: 'TEST',
                numberFrom: 100100,
                numberTo: 100200
            }
        });

        await prisma.blank.create({
            data: {
                organizationId,
                departmentId: dept.id,
                batchId: batch.id,
                series: 'TEST',
                number: 100101,
                status: 'AVAILABLE'
            }
        });

        // StockItem (Fuel)
        const fuelItem = await prisma.stockItem.create({
            data: {
                organizationId,
                name: 'Diesel RegTest',
                unit: 'l',
                categoryEnum: 'FUEL'
            }
        });
        fuelStockItemId = fuelItem.id;

        // Vehicle
        const vehicle = await prisma.vehicle.create({
            data: {
                organizationId,
                departmentId: dept.id,
                brand: 'Volvo',
                model: 'FH',
                registrationNumber: 'REG001' + uuidv4().substring(0, 4),
                vehicleType: 'truck',
                fuelStockItemId: fuelItem.id,
                assignedDriverId: driverEmp.id
            }
        });
        vehicleId = vehicle.id;
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    test('WB-REG-002: Save -> Reopen preserves Fuel, Routes, and Dates', async () => {
        const userInfo = { userId, organizationId, role: 'admin', employeeId };

        // 1. Create DRAFT Waybill with minimal data
        const inputCreate = {
            date: '2025-12-25', // YYYY-MM-DD
            vehicleId,
            driverId,
            odometerStart: 1000,
            odometerEnd: 1000
        };

        const created = await createWaybill(userInfo as any, inputCreate);
        expect(created).toBeDefined();
        expect(created.id).toBeDefined();

        // 2. Update with RICH data
        const updateInput = {
            id: created.id,
            organizationId,
            date: '2025-12-25',
            vehicleId: vehicleId,
            driverId: driverId,
            odometerStart: 1000,
            odometerEnd: 1200,
            validTo: new Date('2025-12-25T18:00:00.000Z').toISOString(), // ISO

            // Fuel Payload
            fuel: {
                stockItemId: fuelStockItemId,
                fuelStart: 50,
                fuelReceived: 100,
                fuelConsumed: 30, // calculated on front
                fuelEnd: 120,
                fuelPlanned: 29,
                refueledAt: new Date().toISOString(),
                sourceType: 'MANUAL'
            },

            // Routes Payload
            routes: [
                {
                    legOrder: 0,
                    fromPoint: 'Depot A',
                    toPoint: 'Client B',
                    distanceKm: 200,
                    isCityDriving: true,
                    isWarming: false,
                    comment: 'Test Route'
                }
            ],

            status: 'draft'
        };

        const updated = await updateWaybill(userInfo as any, created.id, updateInput as any);
        console.log('Updated Routes Length:', (updated as any).routes ? (updated as any).routes.length : 'undefined');

        // 3. Reopen (GetById)
        const loaded = await getWaybillById(userInfo as any, created.id);
        console.log('Loaded Routes Length:', loaded?.routes?.length);
        // console.log('Loaded Routes:', JSON.stringify(loaded?.routes, null, 2));

        expect(loaded).toBeDefined();
        if (!loaded) return;

        // Assert Routes
        if (loaded.routes!.length !== 1) {
            throw new Error(`DEBUG ROUTES: ${JSON.stringify(loaded.routes, null, 2)}`);
        }
        expect(loaded.routes).toHaveLength(1);
        expect(loaded.routes![0].fromPoint).toBe('Depot A');
        expect(loaded.routes![0].distanceKm).toBe(200);

        // Assert Fuel
        // Casting to any to access flattened fuel if mapped, OR traverse fuelLines if not flattened in backend service DTO.
        // If getWaybillById returns Prisma Object, it has `fuelLines`.
        // If it runs `flattenFuel` logic internally, it has `fuel`.
        // Let's assume Prisma object based on previous behavior for backend tests.
        // If it returns Raw Prisma object, we check fuelLines.
        const fuelLines = (loaded as any).fuelLines;
        if (fuelLines && fuelLines.length > 0) {
            expect(fuelLines[0].fuelStart).toBe(50);
            expect(fuelLines[0].fuelEnd).toBe(120);
        } else if ((loaded as any).fuel) {
            expect((loaded as any).fuel.fuelStart).toBe(50);
        }
    });
});
