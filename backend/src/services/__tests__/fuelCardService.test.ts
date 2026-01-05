import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient, WaybillStatus } from '@prisma/client';
import { getDraftReserve } from '../fuelCardService';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

describe('Fuel Card Service (Draft Reserve)', () => {
    let organizationId: string;
    let fuelCardId: string;
    let stockItemId: string;
    let mockUser: any;

    beforeAll(async () => {
        const org = await prisma.organization.create({
            data: { name: 'FuelReserveTest Org ' + uuidv4(), inn: '1234567890' }
        });
        organizationId = org.id;

        mockUser = { organizationId, role: 'admin' };

        const card = await prisma.fuelCard.create({
            data: {
                organizationId,
                cardNumber: 'FC-' + uuidv4(),
                isActive: true,
                balanceLiters: 1000
            }
        });
        fuelCardId = card.id;

        const item = await prisma.stockItem.create({
            data: {
                organizationId,
                departmentId: '00000000-0000-0000-0000-000000000000',
                name: 'Diesel Test',
                code: 'FUEL-TEST-' + uuidv4(),
                unit: 'l',
                isFuel: true,
                categoryEnum: 'FUEL',
                // category: 'FUEL' // Removed legacy
            }
        });
        stockItemId = item.id;

        const dept = await prisma.department.create({ data: { name: 'Dept', organizationId } });
        const emp = await prisma.employee.create({
            data: { organizationId, fullName: 'Driver', departmentId: dept.id, employeeType: 'driver' }
        });
        const driver = await prisma.driver.create({ data: { employeeId: emp.id, licenseNumber: 'DOC-' + uuidv4() } });
        const vehicle = await prisma.vehicle.create({
            data: {
                organizationId,
                registrationNumber: 'V-' + uuidv4(),
                brand: 'Volvo',
                vehicleType: 'TRUCK'
            }
        });

        (global as any).testDriverId = driver.id;
        (global as any).testVehicleId = vehicle.id;
    });

    afterAll(async () => {
        await prisma.waybill.deleteMany({ where: { organizationId } });
        await prisma.vehicle.deleteMany({ where: { organizationId } });
        await prisma.driver.deleteMany({ where: { employee: { organizationId } } });
        await prisma.employee.deleteMany({ where: { organizationId } });
        await prisma.stockItem.deleteMany({ where: { id: stockItemId } });
        await prisma.fuelCard.deleteMany({ where: { id: fuelCardId } });
        await prisma.department.deleteMany({ where: { organizationId } });
        await prisma.organization.deleteMany({ where: { id: organizationId } });
    });

    test('getDraftReserve should sum fuel from DRAFT and SUBMITTED waybills', async () => {
        const driverId = (global as any).testDriverId;
        const vehicleId = (global as any).testVehicleId;

        // 1. DRAFT Waybill (100L)
        const wb1 = await prisma.waybill.create({
            data: {
                organizationId,
                number: 'WB-TEST-DRAFT-' + uuidv4(),
                date: new Date(),
                status: WaybillStatus.DRAFT,
                fuelCardId,
                vehicleId,
                driverId,
                fuelLines: {
                    create: { stockItemId, fuelReceived: 100 }
                }
            }
        });

        // 2. SUBMITTED Waybill (50L) -> Should be included!
        const wb2 = await prisma.waybill.create({
            data: {
                organizationId,
                number: 'WB-TEST-SUBMITTED-' + uuidv4(),
                date: new Date(),
                status: WaybillStatus.SUBMITTED,
                fuelCardId,
                vehicleId,
                driverId,
                fuelLines: {
                    create: { stockItemId, fuelReceived: 50 }
                }
            }
        });

        // 3. POSTED Waybill (200L) -> Should be ignored
        await prisma.waybill.create({
            data: {
                organizationId,
                number: 'WB-TEST-POSTED-' + uuidv4(),
                date: new Date(),
                status: WaybillStatus.POSTED,
                fuelCardId,
                vehicleId,
                driverId,
                fuelLines: {
                    create: { stockItemId, fuelReceived: 200 }
                }
            }
        });

        // 4. CANCELLED Waybill (300L) -> Should be ignored
        await prisma.waybill.create({
            data: {
                organizationId,
                number: 'WB-TEST-CANCELLED-' + uuidv4(),
                date: new Date(),
                status: WaybillStatus.CANCELLED,
                fuelCardId,
                vehicleId,
                driverId,
                fuelLines: {
                    create: { stockItemId, fuelReceived: 300 }
                }
            }
        });

        // Check total reserve (100 + 50 = 150)
        const result = await getDraftReserve(mockUser, fuelCardId);
        expect(result.reserved).toBe(150);
        expect(result.count).toBe(2);

        // Check exclude Waybill 1
        const resultExcluded = await getDraftReserve(mockUser, fuelCardId, wb1.id);
        expect(resultExcluded.reserved).toBe(50);
        expect(resultExcluded.count).toBe(1);
    });
});
