import { test, expect } from '@playwright/test';

/**
 * E2E Test for Waybill-Stock Integration (API-focused)
 * 
 * Проверяет полный цикл через API:
 * 1. Login через UI → получить JWT token
 * 2. Создание путевого листа с fuelLines через API
 * 3. Смена статусов: DRAFT → SUBMITTED → POSTED через API
 * 4. Проверка создания StockMovement через API
 * 5. Проверка pagination через API
 * 
 * Основано на: backend/scripts/verify-integration.ts
 */

const API_URL = 'http://localhost:3001/api';

interface TestContext {
    token: string;
    stockItemId: string;
    vehicleId: string;
    driverId: string;
    waybillId: string;
    waybillNumber: string;
}

test.describe('Waybill-Stock Integration (API)', () => {
    let context: TestContext;

    test.beforeAll(async () => {
        // Проверка доступности backend
        const healthCheck = await fetch(`${API_URL}/health`).catch(() => null);
        if (!healthCheck || !healthCheck.ok) {
            throw new Error('❌ Backend недоступен. Запустите: cd backend && npm run dev');
        }
        console.log('✅ Backend доступен');
    });

    test('Full waybill lifecycle: Login → Create → DRAFT → SUBMITTED → POSTED → StockMovement', async ({ page, request }) => {
        // Step 1: Login через UI
        console.log('\n📝 Step 1: Login through UI');
        await page.goto('/');
        await page.waitForSelector('text=Вход в систему', { timeout: 10000 });

        await page.getByTestId('login-email').fill('admin');
        await page.getByTestId('login-password').fill('123');
        await page.getByTestId('login-submit').click();

        // Ждем успешного входа
        await page.waitForURL(/\//, { timeout: 10000 });
        await expect(page.getByText('Вход в систему')).toHaveCount(0);
        console.log('✅ Logged in as admin');

        // Получаем токен из localStorage
        const token = await page.evaluate(() => localStorage.getItem('__auth_token__'));
        expect(token).toBeTruthy();
        context = { token: token!, stockItemId: '', vehicleId: '', driverId: '', waybillId: '', waybillNumber: '' };
        console.log(`✅ Token extracted: ${token!.substring(0, 20)}...`);

        // Step 2: Получить stock item
        console.log('\n📝 Step 2: Get Stock Item via API');
        const stockResponse = await request.get(`${API_URL}/stock/items`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        expect(stockResponse.ok()).toBeTruthy();

        const stockData = await stockResponse.json();
        const items = Array.isArray(stockData) ? stockData : (stockData.data || []);
        const fuelItem = items.find((item: any) => item.isFuel) || items[0];

        expect(fuelItem).toBeTruthy();
        context.stockItemId = fuelItem.id;
        console.log(`✅ Found stock item: ${fuelItem.name} (ID: ${fuelItem.id})`);

        // Step 3: Получить vehicle и driver
        console.log('\n📝 Step 3: Get Vehicle and Driver via API');
        const [vehiclesResponse, driversResponse] = await Promise.all([
            request.get(`${API_URL}/vehicles`, { headers: { 'Authorization': `Bearer ${token}` } }),
            request.get(`${API_URL}/drivers`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        expect(vehiclesResponse.ok()).toBeTruthy();
        expect(driversResponse.ok()).toBeTruthy();

        const vehiclesData = await vehiclesResponse.json();
        const driversData = await driversResponse.json();

        const vehicles = Array.isArray(vehiclesData) ? vehiclesData : (vehiclesData.data || []);
        const drivers = Array.isArray(driversData) ? driversData : (driversData.data || []);

        expect(vehicles.length).toBeGreaterThan(0);
        expect(drivers.length).toBeGreaterThan(0);

        context.vehicleId = vehicles[0].id;
        context.driverId = drivers[0].id;
        console.log(`✅ Found ${vehicles.length} vehicles, ${drivers.length} drivers`);

        // Step 4: Создать waybill с fuelLines
        console.log('\n📝 Step 4: Create Waybill with FuelLines via API');
        const waybillNumber = `E2E-TEST-${Date.now()}`;
        const waybillData = {
            number: waybillNumber,
            date: new Date().toISOString().split('T')[0],
            vehicleId: context.vehicleId,
            driverId: context.driverId,
            fuelLines: [{
                stockItemId: context.stockItemId,
                fuelStart: 50,
                fuelReceived: 30,
                fuelConsumed: 25,
                fuelEnd: 55
            }]
        };

        const createResponse = await request.post(`${API_URL}/waybills`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            data: waybillData
        });

        expect(createResponse.ok()).toBeTruthy();
        const createdWaybill = await createResponse.json();

        context.waybillId = createdWaybill.id;
        context.waybillNumber = createdWaybill.number;

        expect(createdWaybill.status).toBe('DRAFT');
        console.log(`✅ Created waybill ${createdWaybill.number} (ID: ${createdWaybill.id}, Status: ${createdWaybill.status})`);

        // Step 5: Смена статуса DRAFT → SUBMITTED
        console.log('\n📝 Step 5: Change Status to SUBMITTED via API');
        const submitResponse = await request.patch(`${API_URL}/waybills/${context.waybillId}/status`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            data: { status: 'SUBMITTED' }
        });

        expect(submitResponse.ok()).toBeTruthy();
        console.log('✅ Changed status to SUBMITTED');

        // Step 6: Смена статуса SUBMITTED → POSTED
        console.log('\n📝 Step 6: Change Status to POSTED via API');
        const postResponse = await request.patch(`${API_URL}/waybills/${context.waybillId}/status`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            data: { status: 'POSTED' }
        });

        expect(postResponse.ok()).toBeTruthy();
        console.log('✅ Changed status to POSTED');

        // Step 7: Проверка создания StockMovement
        console.log('\n📝 Step 7: Verify StockMovement created via API');
        const movementsResponse = await request.get(`${API_URL}/stock/movements?waybillId=${context.waybillId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        expect(movementsResponse.ok()).toBeTruthy();
        const movementsData = await movementsResponse.json();
        const movements = Array.isArray(movementsData) ? movementsData : (movementsData.data || []);

        const expenseMovements = movements.filter((m: any) => m.movementType === 'EXPENSE');
        expect(expenseMovements.length).toBeGreaterThan(0);

        const latestExpense = expenseMovements[0];
        expect(latestExpense.documentType).toBe('WAYBILL');
        expect(latestExpense.documentId).toBe(context.waybillId);
        expect(parseFloat(latestExpense.quantity)).toBe(25); // fuelConsumed

        console.log(`✅ Stock movements: ${movements.length} total, ${expenseMovements.length} EXPENSE`);
        console.log(`   Latest EXPENSE: ${latestExpense.quantity}л, Document: ${latestExpense.documentType} (${latestExpense.documentId})`);

        // Step 8: Проверка pagination
        console.log('\n📝 Step 8: Test Pagination via API');
        const paginationResponse = await request.get(`${API_URL}/waybills?page=1&limit=10`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        expect(paginationResponse.ok()).toBeTruthy();
        const paginationData = await paginationResponse.json();

        expect(paginationData.pagination).toBeTruthy();
        expect(paginationData.pagination.total).toBeGreaterThan(0);
        expect(paginationData.data).toBeTruthy();
        expect(Array.isArray(paginationData.data)).toBeTruthy();

        console.log(`✅ Pagination works: ${paginationData.data.length} records, Total: ${paginationData.pagination.total}, Pages: ${paginationData.pagination.pages}`);

        console.log('\n✅ All API integration tests passed!');
    });

    test('Verify stock movements are linked to correct waybill', async ({ request }) => {
        // Используем данные из предыдущего теста
        if (!context?.token || !context?.waybillId) {
            test.skip();
            return;
        }

        const movementsResponse = await request.get(`${API_URL}/stock/movements`, {
            headers: { 'Authorization': `Bearer ${context.token}` }
        });

        expect(movementsResponse.ok()).toBeTruthy();
        const movementsData = await movementsResponse.json();
        const movements = Array.isArray(movementsData) ? movementsData : (movementsData.data || []);

        // Найти movements связанные с нашим waybill
        const waybillMovements = movements.filter((m: any) => m.documentId === context.waybillId);

        expect(waybillMovements.length).toBeGreaterThan(0);
        console.log(`✅ Found ${waybillMovements.length} movements linked to waybill ${context.waybillId}`);
    });
});
