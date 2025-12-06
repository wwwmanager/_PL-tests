import { test, expect } from '@playwright/test';
import { generateTestId } from './helpers';

/**
 * E2E Test for Department Isolation (API-focused)
 * 
 * Проверяет разграничение доступа по подразделениям:
 * 1. user_dept_a создает ПЛ → должен быть виден только ему
 * 2. user_dept_b НЕ видит ПЛ пользователя dept_a
 * 3. admin видит ВСЕ ПЛ (без привязки к подразделению)
 */

const API_URL = 'http://localhost:3001/api';

async function login(page: any, email: string, password: string): Promise<string> {
    await page.goto('/');
    await page.waitForSelector('text=Вход в систему', { timeout: 10000 });

    await page.getByTestId('login-email').fill(email);
    await page.getByTestId('login-password').fill(password);
    await page.getByTestId('login-submit').click();

    // Wait for either success (URL change) or error message
    try {
        await page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch (e) {
        console.log('⚠️ Network idle timeout, continuing...');
    }

    // Check if login was successful by looking for login form disappearance
    const loginFormCount = await page.getByText('Вход в систему').count();

    if (loginFormCount > 0) {
        // Login failed, try to get error message
        const bodyText = await page.textContent('body');
        console.error(`❌ Login failed for ${email}`);
        console.error(`Page content: ${bodyText?.substring(0, 500)}`);
        throw new Error(`Login failed for ${email}. Login form still visible.`);
    }

    const token = await page.evaluate(() => localStorage.getItem('__auth_token__'));
    if (!token) {
        throw new Error(`Login succeeded but no auth token found for ${email}`);
    }

    return token;
}

test.describe('Department Isolation (API)', () => {
    let waybillIdDeptA: string;
    let waybillIdDeptB: string;

    test.beforeAll(async () => {
        const healthCheck = await fetch(`${API_URL}/health`).catch(() => null);
        if (!healthCheck || !healthCheck.ok) {
            throw new Error('❌ Backend недоступен. Запустите: cd backend && npm run dev');
        }
        console.log('✅ Backend доступен');
    });

    test('user_dept_a creates waybill → visible only to dept_a and admin', async ({ page, request, context }) => {
        // Step 1: Login as user_dept_a
        console.log('\n📝 Step 1: Login as user_dept_a');
        const tokenA = await login(page, 'user_dept_a', '123');
        console.log(`✅ Logged in as user_dept_a, token: ${tokenA.substring(0, 20)}...`);

        // Step 2: Get vehicle and driver from dept_a
        console.log('\n📝 Step 2: Get Vehicle and Driver from Main Department');
        const [vehiclesResponse, driversResponse, stockResponse] = await Promise.all([
            request.get(`${API_URL}/vehicles?limit=10`, { headers: { 'Authorization': `Bearer ${tokenA}` } }),
            request.get(`${API_URL}/drivers?limit=10`, { headers: { 'Authorization': `Bearer ${tokenA}` } }),
            request.get(`${API_URL}/stock/items`, { headers: { 'Authorization': `Bearer ${tokenA}` } })
        ]);

        const vehicles = (await vehiclesResponse.json()).data || (await vehiclesResponse.json());
        const drivers = (await driversResponse.json()).data || (await driversResponse.json());
        const stockItems = (await stockResponse.json()).data || (await stockResponse.json());

        expect(vehicles.length).toBeGreaterThan(0);
        expect(drivers.length).toBeGreaterThan(0);

        const vehicleDeptA = vehicles[0];
        const driverDeptA = drivers[0];
        const fuelItem = stockItems.find((i: any) => i.isFuel) || stockItems[0];

        console.log(`✅ Found Vehicle: ${vehicleDeptA.registrationNumber}, Driver from dept: ${driverDeptA.employee?.departmentId || 'N/A'}`);

        // Step 3: Create waybill as user_dept_a
        console.log('\n📝 Step 3: Create Waybill as user_dept_a');
        const waybillNumber = generateTestId('E2E-DEPT-A');
        const waybillData = {
            number: waybillNumber,
            date: new Date().toISOString().split('T')[0],
            vehicleId: vehicleDeptA.id,
            driverId: driverDeptA.id,
            fuelLines: [{
                stockItemId: fuelItem.id,
                fuelStart: 50,
                fuelReceived: 30,
                fuelConsumed: 25,
                fuelEnd: 55
            }]
        };

        const createResponse = await request.post(`${API_URL}/waybills`, {
            headers: {
                'Authorization': `Bearer ${tokenA}`,
                'Content-Type': 'application/json'
            },
            data: waybillData
        });

        expect(createResponse.ok()).toBeTruthy();
        const createdWaybill = await createResponse.json();
        waybillIdDeptA = createdWaybill.id;
        console.log(`✅ Created waybill ${createdWaybill.number} (ID: ${waybillIdDeptA}) by user_dept_a`);

        // Step 4: Verify user_dept_a can see their own waybill
        console.log('\n📝 Step 4: Verify user_dept_a sees their waybill');
        console.log(`Token being used: ${tokenA.substring(0, 30)}...`);

        const listResponse = await request.get(`${API_URL}/waybills`, {
            headers: { 'Authorization': `Bearer ${tokenA}` }
        });

        console.log(`Response status: ${listResponse.status()}`);

        if (!listResponse.ok()) {
            const errorBody = await listResponse.text();
            console.error(`❌ GET /waybills failed with status ${listResponse.status()}`);
            console.error(`Response body: ${errorBody}`);
            throw new Error(`Failed to get waybills: ${listResponse.status()} - ${errorBody}`);
        }

        const waybills = ((await listResponse.json()).data || (await listResponse.json()));
        const found = waybills.find((wb: any) => wb.id === waybillIdDeptA);
        expect(found).toBeTruthy();
        console.log(`✅ user_dept_a sees their waybill: ${found.number}`);

        // Step 5: Logout
        await page.evaluate(() => localStorage.clear());
        console.log('✅ user_dept_a logged out');

        // Step 6: Login as user_dept_b
        console.log('\n📝 Step 6: Login as user_dept_b');
        const tokenB = await login(page, 'user_dept_b', '123');
        console.log(`✅ Logged in as user_dept_b`);

        // Step 7: Verify user_dept_b does NOT see dept_a waybills
        console.log('\n📝 Step 7: Verify user_dept_b does NOT see dept_a waybill');
        const listResponseB = await request.get(`${API_URL}/waybills`, {
            headers: { 'Authorization': `Bearer ${tokenB}` }
        });

        expect(listResponseB.ok()).toBeTruthy();
        const waybillsB = ((await listResponseB.json()).data || (await listResponseB.json()));
        const notFound = waybillsB.find((wb: any) => wb.id === waybillIdDeptA);
        expect(notFound).toBeFalsy();
        console.log(`✅ user_dept_b correctly does NOT see dept_a waybill (isolation working)`);

        // Step 8: Create waybill as user_dept_b
        console.log('\n📝 Step 8: Create Waybill as user_dept_b');
        const vehiclesResponseB = await request.get(`${API_URL}/vehicles?limit=10`, { headers: { 'Authorization': `Bearer ${tokenB}` } });
        const driversResponseB = await request.get(`${API_URL}/drivers?limit=10`, { headers: { 'Authorization': `Bearer ${tokenB}` } });

        const vehiclesB = (await vehiclesResponseB.json()).data || (await vehiclesResponseB.json());
        const driversB = (await driversResponseB.json()).data || (await driversResponseB.json());

        expect(vehiclesB.length).toBeGreaterThan(0);
        expect(driversB.length).toBeGreaterThan(0);

        const waybillDataB = {
            number: generateTestId('E2E-DEPT-B'),
            date: new Date().toISOString().split('T')[0],
            vehicleId: vehiclesB[0].id,
            driverId: driversB[0].id,
            fuelLines: [{
                stockItemId: fuelItem.id,
                fuelStart: 40,
                fuelConsumed: 20,
                fuelEnd: 20
            }]
        };

        const createResponseB = await request.post(`${API_URL}/waybills`, {
            headers: {
                'Authorization': `Bearer ${tokenB}`,
                'Content-Type': 'application/json'
            },
            data: waybillDataB
        });

        expect(createResponseB.ok()).toBeTruthy();
        const createdWaybillB = await createResponseB.json();
        waybillIdDeptB = createdWaybillB.id;
        console.log(`✅ Created waybill ${createdWaybillB.number} by user_dept_b`);

        // Step 9: Logout
        await page.evaluate(() => localStorage.clear());
        console.log('✅ user_dept_b logged out');

        // Step 10: Login as admin
        console.log('\n📝 Step 10: Login as admin (no department)');
        const tokenAdmin = await login(page, 'admin', '123');
        console.log(`✅ Logged in as admin`);

        // Step 11: Verify admin sees BOTH waybills
        console.log('\n📝 Step 11: Verify admin sees BOTH waybills');
        const listResponseAdmin = await request.get(`${API_URL}/waybills`, {
            headers: { 'Authorization': `Bearer ${tokenAdmin}` }
        });

        expect(listResponseAdmin.ok()).toBeTruthy();
        const waybillsAdmin = ((await listResponseAdmin.json()).data || (await listResponseAdmin.json()));
        const foundA = waybillsAdmin.find((wb: any) => wb.id === waybillIdDeptA);
        const foundB = waybillsAdmin.find((wb: any) => wb.id === waybillIdDeptB);

        expect(foundA).toBeTruthy();
        expect(foundB).toBeTruthy();
        console.log(`✅ admin sees both waybills: ${foundA.number} (dept_a) and ${foundB.number} (dept_b)`);

        console.log('\n✅ All department isolation tests passed!');
    });
});
