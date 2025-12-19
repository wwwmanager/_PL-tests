/**
 * AUTH-001: Integration Tests for Refresh Token System
 * 
 * Tests:
 * 1. Rotation: refresh token can only be used once (old cookie reuse => 401)
 * 2. Concurrent refresh: two parallel refresh calls => one 200, one 401
 * 3. REL-402: transferUser revokes all refresh => refresh 401; re-login => access has new orgId
 */

import request from 'supertest';
import bcrypt from 'bcrypt';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/db/prisma';

const API = '/api';

// Helper: extract access token from response body
function extractAccessToken(body: any): string {
    return (
        body?.data?.token ??
        body?.token ??
        body?.data?.accessToken ??
        body?.accessToken ??
        ''
    );
}

// Helper: decode JWT payload without verification
function decodeJwtPayload(token: string): any {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const json = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(json);
}

// Cookie jar type
type CookieJar = Record<string, string>;

// Helper: update cookie jar from Set-Cookie header
function updateJarFromSetCookie(jar: CookieJar, setCookie?: string | string[]) {
    if (!setCookie) return;
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    for (const raw of cookies) {
        const first = raw.split(';')[0]; // "refreshToken=...."
        const eq = first.indexOf('=');
        if (eq === -1) continue;
        const name = first.slice(0, eq).trim();
        const value = first.slice(eq + 1).trim();
        jar[name] = value;
    }
}

// Helper: build Cookie header from jar
function cookieHeader(jar: CookieJar): string {
    return Object.entries(jar)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
}

describe('AUTH-001 Refresh Token System (rotation + REL-402)', () => {
    let app: ReturnType<typeof createApp>;
    let org1Id: string;
    let org2Id: string;
    let dept1Id: string;
    let dept2Id: string;
    let adminUserId: string;

    const email = `admin.${Date.now()}@waybills.local`;
    const password = '123';

    beforeAll(async () => {
        // Create Express app
        app = createApp();

        // Get or create admin role
        const adminRole =
            (await prisma.role.findUnique({ where: { code: 'admin' } })) ??
            (await prisma.role.create({
                data: { code: 'admin', name: 'Admin' },
            }));

        // Create two organizations + departments
        const org1 = await prisma.organization.create({
            data: { name: 'ORG-1 (auth test)', shortName: 'ORG-1' },
        });
        org1Id = org1.id;

        const dept1 = await prisma.department.create({
            data: { organizationId: org1Id, name: 'DEPT-1' },
        });
        dept1Id = dept1.id;

        const org2 = await prisma.organization.create({
            data: { name: 'ORG-2 (auth test)', shortName: 'ORG-2' },
        });
        org2Id = org2.id;

        const dept2 = await prisma.department.create({
            data: { organizationId: org2Id, name: 'DEPT-2' },
        });
        dept2Id = dept2.id;

        // Create admin user in ORG-1
        const passwordHash = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                organizationId: org1Id,
                departmentId: dept1Id,
                email,
                passwordHash,
                fullName: 'Admin Auth Test',
                isActive: true,
            },
            select: { id: true },
        });
        adminUserId = user.id;

        // Assign admin role
        await prisma.userRole.create({
            data: {
                userId: adminUserId,
                roleId: adminRole.id,
            },
        });
    });

    afterAll(async () => {
        // Cleanup test data
        await prisma.refreshToken.deleteMany({ where: { userId: adminUserId } });
        await prisma.userRole.deleteMany({ where: { userId: adminUserId } });
        await prisma.auditLog.deleteMany({ where: { entityId: adminUserId } });

        await prisma.user.deleteMany({ where: { id: adminUserId } });
        await prisma.department.deleteMany({ where: { id: { in: [dept1Id, dept2Id] } } });
        await prisma.organization.deleteMany({ where: { id: { in: [org1Id, org2Id] } } });

        await prisma.$disconnect();
    });

    it('Rotation: refresh is one-time (old cookie reuse => 401)', async () => {
        const jar: CookieJar = {};

        // Step 1: Login
        const loginRes = await request(app)
            .post(`${API}/auth/login`)
            .send({ email, password });

        expect(loginRes.status).toBe(200);

        updateJarFromSetCookie(jar, loginRes.headers['set-cookie']);
        expect(jar.refreshToken).toBeTruthy();

        const token1 = extractAccessToken(loginRes.body);
        expect(token1).toBeTruthy();

        // Save "old" refresh for reuse attempt
        const oldJar = { ...jar };

        // Step 2: First refresh - should update cookie
        const refresh1 = await request(app)
            .post(`${API}/auth/refresh`)
            .set('Cookie', cookieHeader(jar))
            .send({});

        expect(refresh1.status).toBe(200);
        updateJarFromSetCookie(jar, refresh1.headers['set-cookie']);
        expect(jar.refreshToken).toBeTruthy();
        expect(jar.refreshToken).not.toBe(oldJar.refreshToken);

        // Step 3: Second refresh with OLD cookie => 401 (replay/reuse)
        const refreshOld = await request(app)
            .post(`${API}/auth/refresh`)
            .set('Cookie', cookieHeader(oldJar))
            .send({});

        expect(refreshOld.status).toBe(401);

        console.log('✅ Rotation test passed: old cookie rejected after use');
    });

    it('Concurrent refresh: two parallel refresh calls => one 200, one 401', async () => {
        const jar: CookieJar = {};

        // Step 1: Login
        const loginRes = await request(app)
            .post(`${API}/auth/login`)
            .send({ email, password });

        expect(loginRes.status).toBe(200);
        updateJarFromSetCookie(jar, loginRes.headers['set-cookie']);
        expect(jar.refreshToken).toBeTruthy();

        const cookie = cookieHeader(jar);

        // Step 2: Two parallel refresh requests
        const [r1, r2] = await Promise.all([
            request(app).post(`${API}/auth/refresh`).set('Cookie', cookie).send({}),
            request(app).post(`${API}/auth/refresh`).set('Cookie', cookie).send({}),
        ]);

        const statuses = [r1.status, r2.status].sort();
        expect(statuses).toEqual([200, 401]);

        console.log('✅ Concurrent refresh test passed: one 200, one 401');
    });

    it('REL-402: transferUser revokes all refresh => refresh 401; re-login => access has new orgId', async () => {
        // Step 1: Login
        const jar: CookieJar = {};
        const loginRes = await request(app)
            .post(`${API}/auth/login`)
            .send({ email, password });

        expect(loginRes.status).toBe(200);
        updateJarFromSetCookie(jar, loginRes.headers['set-cookie']);
        const accessToken = extractAccessToken(loginRes.body);
        expect(accessToken).toBeTruthy();

        const payloadBefore = decodeJwtPayload(accessToken);
        expect(payloadBefore.organizationId).toBe(org1Id);

        // Step 2: Transfer user to ORG-2 (admin endpoint)
        const transferRes = await request(app)
            .post(`${API}/admin/transfer-user`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                userId: adminUserId,
                targetOrganizationId: org2Id,
                targetDepartmentId: dept2Id,
            });

        expect([200, 201]).toContain(transferRes.status);

        // Step 3: Refresh => 401 (because transferUser revoked ALL refresh tokens)
        const refreshRes = await request(app)
            .post(`${API}/auth/refresh`)
            .set('Cookie', cookieHeader(jar))
            .send({});

        expect(refreshRes.status).toBe(401);

        // Step 4: Re-login => new access with new claims (org2)
        const loginRes2 = await request(app)
            .post(`${API}/auth/login`)
            .send({ email, password });

        expect(loginRes2.status).toBe(200);

        const token2 = extractAccessToken(loginRes2.body);
        expect(token2).toBeTruthy();

        const payloadAfter = decodeJwtPayload(token2);
        expect(payloadAfter.organizationId).toBe(org2Id);

        console.log('✅ REL-402 test passed: refresh rejected after transfer, new login has new orgId');
    });

    it('AUTH-003: old access token becomes invalid immediately after transferUser (tokenVersion++)', async () => {
        // Step 1: Login
        const loginRes = await request(app)
            .post(`${API}/auth/login`)
            .send({ email, password });

        expect(loginRes.status).toBe(200);

        const accessToken = extractAccessToken(loginRes.body);
        expect(accessToken).toBeTruthy();

        // Step 2: Request profile - should be 200
        const profileBefore = await request(app)
            .get(`${API}/auth/me`)
            .set('Authorization', `Bearer ${accessToken}`);

        expect(profileBefore.status).toBe(200);

        // Step 3: transfer user to org2 (increments tokenVersion)
        const transferRes = await request(app)
            .post(`${API}/admin/transfer-user`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                userId: adminUserId,
                targetOrganizationId: org2Id,
                targetDepartmentId: dept2Id,
            });

        expect([200, 201]).toContain(transferRes.status);

        // Step 4: Any protected request with OLD access token should now be 401
        const profileAfter = await request(app)
            .get(`${API}/auth/me`)
            .set('Authorization', `Bearer ${accessToken}`);

        expect(profileAfter.status).toBe(401);
        expect(profileAfter.body.error).toContain('Сессия недействительна');

        console.log('✅ AUTH-003 test passed: old access token invalidated via tokenVersion++');
    });

    it('AUTH-004.1: logout-all invalidates access immediately and revokes all refresh tokens', async () => {
        const jar: CookieJar = {};

        // Step 1: Login
        const loginRes = await request(app)
            .post(`${API}/auth/login`)
            .send({ email, password });

        expect(loginRes.status).toBe(200);
        updateJarFromSetCookie(jar, loginRes.headers['set-cookie']);
        const accessToken = extractAccessToken(loginRes.body);
        expect(accessToken).toBeTruthy();

        // Step 2: logout-all
        const logoutAllRes = await request(app)
            .post(`${API}/auth/logout-all`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({});

        expect(logoutAllRes.status).toBe(200);
        expect(logoutAllRes.body.success).toBe(true);

        // Step 3: Old access token must become invalid immediately (tokenVersion++)
        const profileRes = await request(app)
            .get(`${API}/auth/me`)
            .set('Authorization', `Bearer ${accessToken}`);

        expect(profileRes.status).toBe(401);
        expect(profileRes.body.error).toContain('Сессия недействительна');

        // Step 4: Refresh must also fail (all tokens revoked)
        const refreshRes = await request(app)
            .post(`${API}/auth/refresh`)
            .set('Cookie', cookieHeader(jar))
            .send({});

        expect(refreshRes.status).toBe(401);

        console.log('✅ AUTH-004.1 test passed: logout-all works for both access and refresh');
    });
});
