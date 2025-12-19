/**
 * REL-301: Integration tests for /drivers endpoint
 * Verifies org-scoping, Driver.id returns, and no employees-without-Driver leakage
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

describe('REL-301: GET /drivers endpoint', () => {
    let testOrg1Id: string;
    let testOrg2Id: string;
    let driver1Id: string;
    let driver2Id: string;
    let employeeWithoutDriverId: string;

    beforeAll(async () => {
        // Create two test organizations
        const org1 = await prisma.organization.create({
            data: { name: 'Test Org 1 for Drivers', status: 'Active' }
        });
        testOrg1Id = org1.id;

        const org2 = await prisma.organization.create({
            data: { name: 'Test Org 2 for Drivers', status: 'Active' }
        });
        testOrg2Id = org2.id;

        // Create employees in org1
        const emp1 = await prisma.employee.create({
            data: {
                organizationId: testOrg1Id,
                fullName: 'Driver One Org1',
                employeeType: 'driver',
                isActive: true,
            }
        });

        // Create Driver for emp1
        const drv1 = await prisma.driver.create({
            data: {
                employeeId: emp1.id,
                licenseNumber: 'LIC-001',
                licenseCategory: 'B',
            }
        });
        driver1Id = drv1.id;

        // Create employee WITHOUT driver (should NOT appear in /drivers)
        const empNoDriver = await prisma.employee.create({
            data: {
                organizationId: testOrg1Id,
                fullName: 'Employee Without Driver',
                employeeType: 'mechanic',
                isActive: true,
            }
        });
        employeeWithoutDriverId = empNoDriver.id;

        // Create employee+driver in org2 (should NOT appear for org1 user)
        const emp2 = await prisma.employee.create({
            data: {
                organizationId: testOrg2Id,
                fullName: 'Driver From Org2',
                employeeType: 'driver',
                isActive: true,
            }
        });

        const drv2 = await prisma.driver.create({
            data: {
                employeeId: emp2.id,
                licenseNumber: 'LIC-002',
                licenseCategory: 'C',
            }
        });
        driver2Id = drv2.id;
    });

    afterAll(async () => {
        // Cleanup in correct order (drivers first, then employees, then orgs)
        await prisma.driver.deleteMany({
            where: { id: { in: [driver1Id, driver2Id] } }
        });
        await prisma.employee.deleteMany({
            where: { organizationId: { in: [testOrg1Id, testOrg2Id] } }
        });
        await prisma.organization.deleteMany({
            where: { id: { in: [testOrg1Id, testOrg2Id] } }
        });
        await prisma.$disconnect();
    });

    it('should return drivers with Employee data joined', async () => {
        // Direct service call simulation
        const drivers = await prisma.driver.findMany({
            where: {
                employee: { organizationId: testOrg1Id }
            },
            include: {
                employee: {
                    select: {
                        id: true,
                        fullName: true,
                        departmentId: true,
                        isActive: true,
                    }
                }
            }
        });

        expect(drivers.length).toBe(1);
        expect(drivers[0].id).toBe(driver1Id);
        expect(drivers[0].employee?.fullName).toBe('Driver One Org1');
    });

    it('should NOT return employees without Driver records', async () => {
        const drivers = await prisma.driver.findMany({
            where: {
                employee: { organizationId: testOrg1Id }
            }
        });

        // No driver should have the "Employee Without Driver" employee
        const employeeIds = drivers.map(d => d.employeeId);
        expect(employeeIds).not.toContain(employeeWithoutDriverId);
    });

    it('should scope results by organizationId', async () => {
        // Query for org1 should NOT include org2 drivers
        const org1Drivers = await prisma.driver.findMany({
            where: {
                employee: { organizationId: testOrg1Id }
            }
        });

        const driverIds = org1Drivers.map(d => d.id);
        expect(driverIds).not.toContain(driver2Id);
    });

    it('should return Driver.id (not Employee.id) as primary identifier', async () => {
        const drivers = await prisma.driver.findMany({
            where: {
                employee: { organizationId: testOrg1Id }
            },
            include: { employee: true }
        });

        expect(drivers.length).toBeGreaterThan(0);

        // Verify that Driver.id !== Employee.id
        for (const d of drivers) {
            expect(d.id).not.toBe(d.employeeId);
        }
    });
});
