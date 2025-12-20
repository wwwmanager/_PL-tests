
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/db/prisma';
import { signAccessToken } from '../../src/utils/jwt';
import request from 'supertest';

describe('Vehicle Persistence Debug', () => {
    let app: any;
    let adminToken: string;
    let organizationId: string;
    let fuelTypeId: string;
    let vehicleId: string;

    beforeAll(async () => {
        app = createApp();

        // 1. Create Org
        const org = await prisma.organization.create({
            data: { name: `Debug Org ${Date.now()}`, status: 'Active' }
        });
        organizationId = org.id;

        // 2. Create User
        const user = await prisma.user.create({
            data: {
                email: `debug_vehicle_${Date.now()}@test.com`,
                organizationId,
                fullName: 'Debug Admin',
                passwordHash: 'hash',
                roles: { create: { role: { connect: { code: 'admin' } } } }
            }
        });

        adminToken = signAccessToken({
            id: user.id,
            organizationId,
            role: 'admin',
            tokenVersion: 0
        });


        // Ensure cleanup from previous failed runs
        // Ensure cleanup from previous failed runs
        try {
            await prisma.fuelType.deleteMany({ where: { code: { in: ['DT_DBG', 'AI-95-UPD'] } } });
        } catch (e) { }

        // 3. Create FuelType
        const ft = await prisma.fuelType.create({
            data: {
                name: 'Diesel Debug',
                code: 'DT_DBG'
                // organizationId is not invalid
            }
        });
        fuelTypeId = ft.id;
    });

    afterAll(async () => {
        // Cleanup
        try {
            if (organizationId) {
                await prisma.organization.delete({ where: { id: organizationId } });
            }
            // FuelType is global, clean it up
            await prisma.fuelType.deleteMany({ where: { code: { in: ['DT_DBG', 'AI-95-UPD'] } } });
        } catch (e) { }
    });

    it('should save and retrieve Status and FuelType correctly', async () => {
        // Create Vehicle
        const createRes = await request(app)
            .post('/api/vehicles')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                organizationId,
                registrationNumber: `D${Date.now()}`,
                brand: 'TestBrand',
                // Sending ID only, usually how frontend dropdowns work
                fuelTypeId: fuelTypeId,
                // Sending status as string, mimicking frontend
                status: 'ACTIVE',
                // Optional: fuelType string might be empty from frontend if only ID is selected
                fuelType: null
            });

        expect(createRes.status).toBe(201);
        vehicleId = createRes.body.id;

        // Verify creation response
        console.log('Create Response Body:', createRes.body);
        expect(createRes.body.fuelTypeId).toBe(fuelTypeId);
        // Expect status to be returned transformed? Or as saved?
        // Service returns prisma objects... wait, createVehicle returns "vehicle" directly from prisma.
        // It DOES NOT map status in createVehicle (line 137 returns vehicle).
        // So create response has `isActive: true`, but maybe not `status: 'ACTIVE'`.
        // Let's check logs.

        // GET Vehicle (Re-open simulation)
        const getRes = await request(app)
            .get(`/api/vehicles/${vehicleId}`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(getRes.status).toBe(200);
        const fetched = getRes.body;
        console.log('GET Response Body:', fetched);

        // Check Status
        expect(fetched.status).toBe('ACTIVE'); // Service maps this manually

        // Check Fuel Type
        // If frontend needs the relation to display the name, it must be present
        // Check if `fuelTypeRelation` is present
        // or if `fuelType` string is present (it shouldn't be if we sent null)

        // If the UI relies on `fuelTypeRelation`, we need to check if it's there.
        // If the UI relies on loaded dictionary + fuelTypeId, then fuelTypeId is enough.
        expect(fetched.fuelTypeId).toBe(fuelTypeId);

        // ----------------------------------------------------
        // UPDATE Verification (Reproducing bugs)
        // ----------------------------------------------------

        // 1. Create a NEW FuelType to switch to
        const ft2 = await prisma.fuelType.create({
            data: { name: 'Benzin Update', code: 'AI-95-UPD' }
        });

        // 2. Perform Update
        // Use 'Inactive' (TitleCase) as per DTO, checking if Service handles it (Service expects 'ARCHIVED'?)
        const updateRes = await request(app)
            .put(`/api/vehicles/${vehicleId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                registrationNumber: fetched.registrationNumber,
                // Changing status to Inactive (Russian text)
                status: 'Неактивен',
                // Changing Fuel Type: simulate frontend bug sending UUID in fuelType field
                fuelType: ft2.id,
                // fuelTypeId: null (omitted to simulate frontend behavior)
            });

        expect(updateRes.status).toBe(200);

        // 3. Verify Update
        const getUpdated = await request(app)
            .get(`/api/vehicles/${vehicleId}`)
            .set('Authorization', `Bearer ${adminToken}`);

        const updatedVehicle = getUpdated.body;
        console.log('Updated Vehicle:', updatedVehicle);

        // Check Status
        // DTO 'Inactive' -> Service should map to isActive=false -> Get returns 'ARCHIVED'?
        expect(updatedVehicle.status).toBe('ARCHIVED');
        expect(updatedVehicle.isActive).toBe(false);

        // Check FuelType
        expect(updatedVehicle.fuelTypeId).toBe(ft2.id);
        expect(updatedVehicle.fuelTypeRelation).toBeDefined();
        expect(updatedVehicle.fuelTypeRelation.id).toBe(ft2.id);

        // Cleanup extra fuel type
        try { await prisma.fuelType.deleteMany({ where: { code: 'AI-95-UPD' } }); } catch (e) { }
    });
});
