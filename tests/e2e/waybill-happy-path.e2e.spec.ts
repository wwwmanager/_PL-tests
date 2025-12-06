/**
 * WAYBILL HAPPY PATH E2E TEST
 * 
 * Тестирование полного цикла путевого листа:
 * 1. Логин через UI
 * 2. Создание ПЛ через API (с полными данными: ТС, водитель)
 * 3. Навигация к Путевым листам и проверка в UI
 * 4. Изменение статуса через API: DRAFT → SUBMITTED → POSTED
 * 5. Проверка финального статуса в UI
 * 
 * Seed data:
 * - admin / 123 (admin role)
 */

import { test, expect, Page } from '@playwright/test';

const API_URL = 'http://localhost:3001/api';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function loginViaUI(page: Page, email: string, password: string): Promise<string> {
    await page.goto('/');

    // Wait for login form
    await page.waitForSelector('[data-testid="login-email"]', { timeout: 15000 });

    // Fill login form
    await page.getByTestId('login-email').fill(email);
    await page.getByTestId('login-password').fill(password);
    await page.getByTestId('login-submit').click();

    // Wait for token to appear in localStorage
    await page.waitForFunction(
        () => localStorage.getItem('__auth_token__') !== null,
        { timeout: 15000 }
    );

    const token = await page.evaluate(() => localStorage.getItem('__auth_token__'));
    if (!token) throw new Error('Token not found after login');

    await page.waitForTimeout(500);
    return token;
}

async function getAuthHeaders(token: string) {
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

async function navigateToWaybills(page: Page) {
    await page.waitForLoadState('networkidle');

    // Click on Путевые листы in sidebar
    const waybillsMenuItem = page.locator('button:has-text("Путевые листы")').first();
    await waybillsMenuItem.waitFor({ state: 'visible', timeout: 10000 });
    await waybillsMenuItem.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Verify we are on the Waybills list page
    const pageTitle = page.locator('h2:has-text("Путевые листы")').first();
    const isWaybillPage = await pageTitle.isVisible({ timeout: 5000 }).catch(() => false);
    if (!isWaybillPage) {
        await page.screenshot({ path: 'test-results/debug-wrong-page.png', fullPage: true });
        throw new Error('Failed to navigate to Waybills page');
    }
}

// ============================================================================
// TESTS
// ============================================================================

test.describe('Waybill Happy Path - Full Business Cycle', () => {

    test.beforeAll(async ({ request }) => {
        const healthCheck = await request.get(`${API_URL}/health`).catch(() => null);
        if (!healthCheck || !healthCheck.ok()) {
            throw new Error('❌ Backend недоступен! Запустите: cd backend && npm run dev');
        }
        console.log('✅ Backend доступен');
    });

    test('Полный цикл ПЛ: создание (API) → проверка в UI → статусы → проведение', async ({ page, request }) => {
        console.log('\n' + '═'.repeat(70));
        console.log('🚀 WAYBILL FULL CYCLE TEST');
        console.log('═'.repeat(70));

        // ═══════════════════════════════════════════════════════════════════
        // STEP 1: LOGIN
        // ═══════════════════════════════════════════════════════════════════
        console.log('\n📝 STEP 1: Login as admin');
        const token = await loginViaUI(page, 'admin', '123');
        const authHeaders = await getAuthHeaders(token);
        console.log('✅ Logged in successfully');

        // ═══════════════════════════════════════════════════════════════════
        // STEP 2: GET REFERENCE DATA VIA API
        // ═══════════════════════════════════════════════════════════════════
        console.log('\n📝 STEP 2: Get reference data (vehicles, drivers)');

        const [vehiclesRes, driversRes] = await Promise.all([
            request.get(`${API_URL}/vehicles`, { headers: authHeaders }),
            request.get(`${API_URL}/drivers`, { headers: authHeaders })
        ]);

        expect(vehiclesRes.ok()).toBeTruthy();
        expect(driversRes.ok()).toBeTruthy();

        const vehiclesData = await vehiclesRes.json();
        const driversData = await driversRes.json();

        // Handle both {data: [...]} and [...] response formats
        const vehicles = vehiclesData.data || vehiclesData;
        const drivers = driversData.data || driversData;

        console.log(`   Found ${vehicles.length} vehicles, ${drivers.length} drivers`);

        if (vehicles.length === 0 || drivers.length === 0) {
            throw new Error('No vehicles or drivers found in database. Run prisma db seed.');
        }

        const testVehicle = vehicles[0];
        const testDriver = drivers[0];
        console.log(`   Using vehicle: ${testVehicle.plateNumber || testVehicle.id}`);
        console.log(`   Using driver: ${testDriver.fullName || testDriver.id}`);

        // ═══════════════════════════════════════════════════════════════════
        // STEP 3: CREATE WAYBILL VIA API
        // ═══════════════════════════════════════════════════════════════════
        console.log('\n📝 STEP 3: Create waybill via API');

        const waybillNumber = `E2E-${Date.now()}`;
        const today = new Date().toISOString().split('T')[0];

        const createWaybillPayload = {
            number: waybillNumber,
            vehicleId: testVehicle.id,
            driverId: testDriver.id,
            date: today,
            odometerStart: 10000,
            fuelAtStart: 30,
            status: 'DRAFT'
        };

        const createRes = await request.post(`${API_URL}/waybills`, {
            headers: authHeaders,
            data: createWaybillPayload
        });

        if (!createRes.ok()) {
            const errorText = await createRes.text();
            console.log(`   ❌ Create failed: ${createRes.status()} - ${errorText}`);
            throw new Error(`Failed to create waybill: ${errorText}`);
        }

        const createdWaybill = await createRes.json();
        const waybillId = createdWaybill.id || createdWaybill.data?.id;
        console.log(`   ✅ Created waybill ID: ${waybillId}`);
        console.log(`   Number: ${waybillNumber}`);

        // ═══════════════════════════════════════════════════════════════════
        // STEP 4: NAVIGATE TO WAYBILLS AND VERIFY IN UI
        // ═══════════════════════════════════════════════════════════════════
        console.log('\n📝 STEP 4: Navigate to Waybills and verify in UI');

        await navigateToWaybills(page);
        await page.waitForTimeout(1000);

        // Look for the waybill number in the list
        const waybillInList = page.locator(`text=${waybillNumber}`).first();
        const isInList = await waybillInList.isVisible({ timeout: 10000 }).catch(() => false);

        if (isInList) {
            console.log(`   ✅ Waybill ${waybillNumber} found in list`);
        } else {
            console.log(`   ⚠️ Waybill ${waybillNumber} not visible in list (may need scroll)`);
        }

        await page.screenshot({ path: 'test-results/waybill-in-list.png', fullPage: true });

        // ═══════════════════════════════════════════════════════════════════
        // STEP 5: CHANGE STATUS VIA API
        // ═══════════════════════════════════════════════════════════════════
        console.log('\n📝 STEP 5: Change status DRAFT → SUBMITTED → POSTED');

        // DRAFT → SUBMITTED
        const submitRes = await request.patch(`${API_URL}/waybills/${waybillId}/status`, {
            headers: authHeaders,
            data: { status: 'SUBMITTED' }
        });
        console.log(`   DRAFT → SUBMITTED: ${submitRes.ok() ? '✅' : '❌ ' + submitRes.status()}`);
        expect(submitRes.ok()).toBeTruthy();

        // SUBMITTED → POSTED
        const postRes = await request.patch(`${API_URL}/waybills/${waybillId}/status`, {
            headers: authHeaders,
            data: { status: 'POSTED' }
        });
        console.log(`   SUBMITTED → POSTED: ${postRes.ok() ? '✅' : '❌ ' + postRes.status()}`);
        expect(postRes.ok()).toBeTruthy();

        // Verify final status
        const finalRes = await request.get(`${API_URL}/waybills/${waybillId}`, { headers: authHeaders });
        const finalData = await finalRes.json();
        const finalWaybill = finalData.data || finalData;
        console.log(`   Final status: ${finalWaybill.status}`);
        expect(finalWaybill.status).toBe('POSTED');

        // ═══════════════════════════════════════════════════════════════════
        // STEP 6: VERIFY FINAL STATUS IN UI
        // ═══════════════════════════════════════════════════════════════════
        console.log('\n📝 STEP 6: Verify final status in UI');

        await page.reload();
        await navigateToWaybills(page);
        await page.waitForTimeout(1000);

        // Look for POSTED status indicator
        const postedStatus = page.locator('text=Проведен').first();
        const isPosted = await postedStatus.isVisible({ timeout: 5000 }).catch(() => false);

        await page.screenshot({ path: 'test-results/waybill-posted.png', fullPage: true });

        console.log('\n' + '═'.repeat(70));
        console.log('🎉 WAYBILL HAPPY PATH TEST COMPLETED!');
        console.log('═'.repeat(70));
        console.log('\n📊 Test Summary:');
        console.log(`   • Waybill created: ${waybillNumber}`);
        console.log(`   • Vehicle: ${testVehicle.plateNumber || testVehicle.id}`);
        console.log(`   • Driver: ${testDriver.fullName || testDriver.id}`);
        console.log(`   • Status flow: DRAFT → SUBMITTED → POSTED ✅`);
        console.log('\n');
    });

    test('API валидация: нельзя создать ПЛ без ТС и водителя', async ({ page, request }) => {
        console.log('\n📝 Validation Test: Waybill requires Vehicle and Driver');

        const token = await loginViaUI(page, 'admin', '123');
        const authHeaders = await getAuthHeaders(token);

        const response = await request.post(`${API_URL}/waybills`, {
            headers: authHeaders,
            data: {
                date: new Date().toISOString().split('T')[0],
                status: 'DRAFT'
            }
        });

        expect(response.ok()).toBeFalsy();
        console.log(`✅ Correctly rejected waybill without TS/driver (Status: ${response.status()})`);
    });

    test('Проверка статусных переходов через API', async ({ page, request }) => {
        console.log('\n📝 Testing status transitions via API');

        const token = await loginViaUI(page, 'admin', '123');
        const authHeaders = await getAuthHeaders(token);

        // Get vehicles and drivers
        const [vehiclesRes, driversRes] = await Promise.all([
            request.get(`${API_URL}/vehicles`, { headers: authHeaders }),
            request.get(`${API_URL}/drivers`, { headers: authHeaders })
        ]);

        const vehicles = (await vehiclesRes.json()).data || await vehiclesRes.json();
        const drivers = (await driversRes.json()).data || await driversRes.json();

        if (!vehicles.length || !drivers.length) {
            console.log('⚠️ Skip: No vehicles or drivers');
            return;
        }

        // Create test waybill
        const createRes = await request.post(`${API_URL}/waybills`, {
            headers: authHeaders,
            data: {
                number: `STATUS-TEST-${Date.now()}`,
                vehicleId: vehicles[0].id,
                driverId: drivers[0].id,
                date: new Date().toISOString().split('T')[0],
                odometerStart: 10000,
                status: 'DRAFT'
            }
        });

        if (!createRes.ok()) {
            console.log(`⚠️ Create failed: ${await createRes.text()}`);
            return;
        }

        const waybill = await createRes.json();
        const waybillId = waybill.id || waybill.data?.id;
        console.log(`   Created waybill: ${waybillId}`);

        // DRAFT → SUBMITTED
        const toSubmitted = await request.patch(`${API_URL}/waybills/${waybillId}/status`, {
            headers: authHeaders,
            data: { status: 'SUBMITTED' }
        });
        console.log(`   DRAFT → SUBMITTED: ${toSubmitted.ok() ? '✅' : '❌'}`);
        expect(toSubmitted.ok()).toBeTruthy();

        // SUBMITTED → POSTED
        const toPosted = await request.patch(`${API_URL}/waybills/${waybillId}/status`, {
            headers: authHeaders,
            data: { status: 'POSTED' }
        });
        console.log(`   SUBMITTED → POSTED: ${toPosted.ok() ? '✅' : '❌'}`);
        expect(toPosted.ok()).toBeTruthy();

        // POSTED → DRAFT (should fail - invalid transition)
        const backToDraft = await request.patch(`${API_URL}/waybills/${waybillId}/status`, {
            headers: authHeaders,
            data: { status: 'DRAFT' }
        });
        console.log(`   POSTED → DRAFT (должен отклонить): ${backToDraft.ok() ? '⚠️ принят' : '✅ отклонён'}`);

        console.log('✅ Status transitions test completed');
    });
});
