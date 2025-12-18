import { test, expect } from '@playwright/test';

/**
 * E2E Test for Blanks Workflow (API-focused)
 * 
 * Проверяет полный жизненный цикл бланков БСО через API:
 * 1. Login → JWT token
 * 2. Создание партии бланков через API
 * 3. Материализация (если требуется отдельно от создания)
 * 4. Выдача бланка водителю (AVAILABLE → ISSUED)
 * 5. Создание ПЛ с привязкой к бланку
 * 6. Проведение ПЛ (ISSUED → USED)
 * 7. Проверка, что бланк нельзя повторно использовать
 */

const API_URL = 'http://localhost:3001/api';

interface TestContext {
    token: string;
    batchId: string;
    blankId: string;
    vehicleId: string;
    driverId: string;
    waybillId: string;
    stockItemId: string;
}

test.describe('Blanks Workflow (API)', () => {
    let context: TestContext;

    test.beforeAll(async () => {
        const healthCheck = await fetch(`${API_URL}/health`).catch(() => null);
        if (!healthCheck || !healthCheck.ok) {
            throw new Error('❌ Backend недоступен. Запустите: cd backend && npm run dev');
        }
        console.log('✅ Backend доступен');
    });

    test('Full blanks lifecycle: Create Batch → Materialize → Issue → Use in Waybill → Mark as USED', async ({ page, request }) => {
        // Step 1: Login через UI
        console.log('\n📝 Step 1: Login through UI');
        await page.goto('/');
        await page.waitForSelector('text=Вход в систему', { timeout: 10000 });

        await page.getByTestId('login-email').fill('admin');
        await page.getByTestId('login-password').fill('123');
        await page.getByTestId('login-submit').click();

        await page.waitForURL(/\//, { timeout: 10000 });
        await expect(page.getByText('Вход в систему')).toHaveCount(0);
        console.log('✅ Logged in as admin');

        const token = await page.evaluate(() => localStorage.getItem('__auth_token__'));
        expect(token).toBeTruthy();
        context = { token: token!, batchId: '', blankId: '', vehicleId: '', driverId: '', waybillId: '', stockItemId: '' };
        console.log(`✅ Token extracted: ${token!.substring(0, 20)}...`);

        // Step 2: Get vehicle and driver FIRST (to know departmentId)
        console.log('\n📝 Step 2: Get Driver and Vehicle via API');
        const [vehiclesResponse, driversResponse] = await Promise.all([
            request.get(`${API_URL}/vehicles?limit=1`, { headers: { 'Authorization': `Bearer ${token}` } }),
            request.get(`${API_URL}/drivers?limit=1`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        expect(vehiclesResponse.ok()).toBeTruthy();
        expect(driversResponse.ok()).toBeTruthy();

        const vehiclesData = await vehiclesResponse.json();
        const driversData = await driversResponse.json();

        const vehicles = (vehiclesData.data || vehiclesData);
        const drivers = (driversData.data || driversData);

        expect(vehicles.length).toBeGreaterThan(0);
        expect(drivers.length).toBeGreaterThan(0);

        const vehicle = vehicles[0];
        const driver = drivers[0];
        context.vehicleId = vehicle.id;
        context.driverId = driver.id;
        console.log(`✅ Found Vehicle: ${vehicle.registrationNumber}, Driver: ${driver.employee?.fullName || driver.id}, DepartmentId: ${vehicle.departmentId}`);

        // Step 3: Создать партию бланков with same departmentId as vehicle
        console.log('\n📝 Step 3: Create Blank Batch via API (with departmentId)');
        const batchData = {
            series: `E2E-${Date.now()}`,
            numberFrom: 1,
            numberTo: 50,
            departmentId: vehicle.departmentId  // IMPORTANT: Use vehicle's department
        };

        const batchResponse = await request.post(`${API_URL}/blanks/batches`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            data: batchData
        });

        expect(batchResponse.ok()).toBeTruthy();
        const batch = await batchResponse.json();
        context.batchId = batch.id;
        console.log(`✅ Created batch: ${batch.series} (${batch.numberFrom}-${batch.numberTo}), ID: ${batch.id}, DepartmentId: ${vehicle.departmentId}`);

        // Step 4: Получить blank (createBatch уже создал blanks автоматически)
        console.log('\n📝 Step 4: Get Available Blank via API');
        const blanksResponse = await request.get(`${API_URL}/blanks?series=${batchData.series}&status=AVAILABLE&limit=1`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        expect(blanksResponse.ok()).toBeTruthy();
        const blanksData = await blanksResponse.json();
        const blanks = (blanksData.items || blanksData.data || blanksData);
        expect(blanks.length).toBeGreaterThan(0);

        const availableBlank = blanks[0];
        context.blankId = availableBlank.id;
        console.log(`✅ Found available blank: ${availableBlank.series} №${availableBlank.number} (ID: ${availableBlank.id})`);

        // Step 5: Выдать бланк водителю
        console.log('\n📝 Step 5: Issue Blank to Driver via API');
        const issueResponse = await request.post(`${API_URL}/blanks/issue`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            data: {
                series: availableBlank.series,
                number: availableBlank.number,
                driverId: context.driverId,
                vehicleId: context.vehicleId
            }
        });

        expect(issueResponse.ok()).toBeTruthy();
        const issuedBlank = await issueResponse.json();
        expect(issuedBlank.status).toBe('ISSUED');
        expect(issuedBlank.issuedToDriverId).toBe(context.driverId);
        console.log(`✅ Blank issued successfully, Status: ${issuedBlank.status}`);

        // Step 6: Получить stock item для ПЛ
        console.log('\n📝 Step 6: Get Stock Item (Fuel) via API');
        const stockResponse = await request.get(`${API_URL}/stock/items`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        expect(stockResponse.ok()).toBeTruthy();
        const stockData = await stockResponse.json();
        const items = Array.isArray(stockData) ? stockData : (stockData.data || []);
        const fuelItem = items.find((item: any) => item.isFuel) || items[0];
        context.stockItemId = fuelItem.id;
        console.log(`✅ Found fuel item: ${fuelItem.name}`);

        // Step 7: Создать ПЛ с этим бланком
        console.log('\n📝 Step 7: Create Waybill with Issued Blank via API');
        const waybillNumber = `E2E-BLANK-${Date.now()}`;
        const waybillData = {
            number: waybillNumber,
            date: new Date().toISOString().split('T')[0],
            vehicleId: context.vehicleId,
            driverId: context.driverId,
            blankId: context.blankId,
            fuelLines: [{
                stockItemId: context.stockItemId,
                fuelStart: 50,
                fuelReceived: 30,
                fuelConsumed: 25,
                fuelEnd: 55
            }]
        };

        const createWaybillResponse = await request.post(`${API_URL}/waybills`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            data: waybillData
        });

        expect(createWaybillResponse.ok()).toBeTruthy();
        const createdWaybill = await createWaybillResponse.json();
        context.waybillId = createdWaybill.id;
        expect(createdWaybill.blankId).toBe(context.blankId);
        console.log(`✅ Created waybill ${createdWaybill.number} with blank ${issuedBlank.series} №${issuedBlank.number}`);

        // Step 8: Провести ПЛ (DRAFT → SUBMITTED → POSTED)
        console.log('\n📝 Step 8: Post Waybill (DRAFT → SUBMITTED → POSTED)');
        await request.patch(`${API_URL}/waybills/${context.waybillId}/status`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            data: { status: 'SUBMITTED' }
        });

        const postResponse = await request.patch(`${API_URL}/waybills/${context.waybillId}/status`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            data: { status: 'POSTED' }
        });

        expect(postResponse.ok()).toBeTruthy();
        console.log('✅ Waybill posted (status: POSTED)');

        // Step 9: Проверить, что бланк теперь USED
        console.log('\n📝 Step 9: Verify Blank status changed to USED');
        const finalBlankResponse = await request.get(`${API_URL}/blanks?series=${issuedBlank.series}&limit=100`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        expect(finalBlankResponse.ok()).toBeTruthy();
        const finalBlanksData = await finalBlankResponse.json();
        const finalBlanks = (finalBlanksData.items || finalBlanksData.data || finalBlanksData);
        const usedBlank = finalBlanks.find((b: any) => b.id === context.blankId);

        expect(usedBlank).toBeTruthy();
        expect(usedBlank.status).toBe('USED');
        console.log(`✅ Blank marked as USED after waybill posting`);

        // Step 10: Проверить, что бланк нельзя выдать повторно
        console.log('\n📝 Step 10: Try to issue USED blank again (should fail)');
        const reissueResponse = await request.post(`${API_URL}/blanks/issue`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            data: {
                series: usedBlank.series,
                number: usedBlank.number,
                driverId: context.driverId,
                vehicleId: context.vehicleId
            }
        });

        // Ожидаем ошибку 400 или 409
        expect(reissueResponse.ok()).toBeFalsy();
        console.log(`✅ Re-issuing USED blank correctly failed with status ${reissueResponse.status()}`);

        console.log('\n✅ All blanks workflow tests passed!');
    });
});
