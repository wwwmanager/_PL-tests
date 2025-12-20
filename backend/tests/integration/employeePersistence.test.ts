
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/db/prisma';
import { signAccessToken } from '../../src/utils/jwt';
import request from 'supertest';

describe('Employee Persistence Debug', () => {
    let app: any;
    let adminToken: string;
    let organizationId: string;

    beforeAll(async () => {
        app = createApp();
        const org = await prisma.organization.create({
            data: { name: `Emp Debug Org ${Date.now()}`, status: 'Active' }
        });
        organizationId = org.id;

        const user = await prisma.user.create({
            data: {
                email: `debug_emp_${Date.now()}@test.com`,
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
    });

    afterAll(async () => {
        if (organizationId) {
            try {
                // Cleanup
                await prisma.employee.deleteMany({ where: { organizationId } });
                await prisma.organization.delete({ where: { id: organizationId } });
            } catch (e) { }
        }
    });

    it('should reproduce 500 error on employee save', async () => {
        // Full payload mimicking frontend form
        const payload = {
            fullName: 'Test Employee',
            shortName: 'T. Employee',
            // organizationId removed (injected by controller/token)
            departmentId: null, // explicit null
            employeeType: 'driver',
            position: 'Driver',
            status: 'Active',
            phone: '+70000000000',
            address: 'Test Address',
            email: 'test@example.com',
            // Dates often cause issues
            dateOfBirth: '1990-01-01',
            personnelNumber: '12345',
            snils: '123-456-789 00',

            // License
            licenseCategory: 'C',
            documentNumber: 'LICENSE123',
            documentExpiry: '2030-01-01',

            // Medical
            medicalCertificateSeries: 'AA',
            medicalCertificateNumber: '123123',
            medicalCertificateIssueDate: '2023-01-01',
            medicalCertificateExpiryDate: '2024-01-01',

            // Fuel Card
            fuelCardNumber: 'CARD123',
            fuelCardBalance: 1000.50, // Number or String? DTO says union

            // Boolean logic test
            isActive: true,

            // Extra field potential check (strict mode?)
            // randomField: 'should fail if strict'
        };

        const res = await request(app)
            .post('/api/employees')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(payload);

        if (res.status === 500) {
            console.log('Reproduced 500 Error:', JSON.stringify(res.body, null, 2));
        } else if (res.status === 400) {
            console.log('Validation Error (400):', JSON.stringify(res.body, null, 2));
        }

        expect(res.status).toBe(201);
    });
});
