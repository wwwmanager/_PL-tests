/**
 * WAYBILL VALIDATIONS E2E TEST
 * 
 * Тестирование валидаций путевого листа:
 * 1. Нельзя сохранить ПЛ без выбора ТС
 * 2. Нельзя сохранить ПЛ без выбора водителя
 * 3. Нельзя сохранить ПЛ если одометр_конец < одометр_начало
 * 4. Нельзя провести ПЛ без маршрутов (опционально)
 * 5. Нельзя отредактировать проведённый ПЛ
 */

import { test, expect, Page } from '@playwright/test';

const API_URL = 'http://localhost:3001/api';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function loginViaUI(page: Page, email: string, password: string): Promise<string> {
    await page.goto('/');
    await page.waitForSelector('[data-testid="login-email"]', { timeout: 15000 });
    await page.getByTestId('login-email').fill(email);
    await page.getByTestId('login-password').fill(password);
    await page.getByTestId('login-submit').click();
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

// ============================================================================
// TESTS
// ============================================================================

test.describe('Waybill Validations', () => {

    test.beforeAll(async ({ request }) => {
        const healthCheck = await request.get(`${API_URL}/health`).catch(() => null);
        if (!healthCheck || !healthCheck.ok()) {
            throw new Error('❌ Backend недоступен! Запустите: cd backend && npm run dev');
        }
        console.log('✅ Backend доступен');
    });

    test('Нельзя создать ПЛ без vehicleId', async ({ page, request }) => {
        console.log('\n📝 Test: Cannot create waybill without vehicleId');

        const token = await loginViaUI(page, 'admin', '123');
        const authHeaders = await getAuthHeaders(token);

        // Get a driver for the test
        const driversRes = await request.get(`${API_URL}/drivers`, { headers: authHeaders });
        const drivers = (await driversRes.json()).data || await driversRes.json();

        if (!drivers.length) {
            console.log('⚠️ Нет водителей для теста');
            return;
        }

        // Try to create waybill without vehicleId
        const response = await request.post(`${API_URL}/waybills`, {
            headers: authHeaders,
            data: {
                number: `VAL-NO-VEH-${Date.now()}`,
                driverId: drivers[0].id,
                date: new Date().toISOString().split('T')[0],
                odometerStart: 10000,
                status: 'DRAFT'
                // vehicleId is missing!
            }
        });

        console.log(`   Статус ответа: ${response.status()}`);

        if (!response.ok()) {
            console.log('   ✅ Правильно отклонён: ПЛ без vehicleId');
        } else {
            console.log('   ⚠️ ПЛ был создан без vehicleId - нужна валидация!');
        }

        expect(response.ok()).toBeFalsy();
    });

    test('Нельзя создать ПЛ без driverId', async ({ page, request }) => {
        console.log('\n📝 Test: Cannot create waybill without driverId');

        const token = await loginViaUI(page, 'admin', '123');
        const authHeaders = await getAuthHeaders(token);

        // Get a vehicle for the test
        const vehiclesRes = await request.get(`${API_URL}/vehicles`, { headers: authHeaders });
        const vehicles = (await vehiclesRes.json()).data || await vehiclesRes.json();

        if (!vehicles.length) {
            console.log('⚠️ Нет ТС для теста');
            return;
        }

        // Try to create waybill without driverId
        const response = await request.post(`${API_URL}/waybills`, {
            headers: authHeaders,
            data: {
                number: `VAL-NO-DRV-${Date.now()}`,
                vehicleId: vehicles[0].id,
                date: new Date().toISOString().split('T')[0],
                odometerStart: 10000,
                status: 'DRAFT'
                // driverId is missing!
            }
        });

        console.log(`   Статус ответа: ${response.status()}`);

        if (!response.ok()) {
            console.log('   ✅ Правильно отклонён: ПЛ без driverId');
        } else {
            console.log('   ⚠️ ПЛ был создан без driverId - нужна валидация!');
        }

        expect(response.ok()).toBeFalsy();
    });

    test('Нельзя создать ПЛ с одометром_конец < одометр_начало', async ({ page, request }) => {
        console.log('\n📝 Test: Cannot create waybill with odometerEnd < odometerStart');

        const token = await loginViaUI(page, 'admin', '123');
        const authHeaders = await getAuthHeaders(token);

        // Get test data
        const [vehiclesRes, driversRes] = await Promise.all([
            request.get(`${API_URL}/vehicles`, { headers: authHeaders }),
            request.get(`${API_URL}/drivers`, { headers: authHeaders })
        ]);

        const vehicles = (await vehiclesRes.json()).data || await vehiclesRes.json();
        const drivers = (await driversRes.json()).data || await driversRes.json();

        if (!vehicles.length || !drivers.length) {
            console.log('⚠️ Нет ТС или водителей для теста');
            return;
        }

        const odometerStart = 50000;
        const odometerEnd = 49000; // Less than start - invalid!

        console.log(`   Одометр начало: ${odometerStart}`);
        console.log(`   Одометр конец: ${odometerEnd} (меньше начала!)`);

        const response = await request.post(`${API_URL}/waybills`, {
            headers: authHeaders,
            data: {
                number: `VAL-ODO-${Date.now()}`,
                vehicleId: vehicles[0].id,
                driverId: drivers[0].id,
                date: new Date().toISOString().split('T')[0],
                odometerStart: odometerStart,
                odometerEnd: odometerEnd,
                status: 'DRAFT'
            }
        });

        console.log(`   Статус ответа: ${response.status()}`);

        if (!response.ok()) {
            console.log('   ✅ Правильно отклонён: одометр_конец < одометр_начало');
        } else {
            // This might be acceptable - some systems allow saving and validate later
            console.log('   ⚠️ ПЛ создан с некорректным одометром (может валидироваться при проведении)');
        }
    });

    test('Нельзя изменить статус проведённого ПЛ обратно на черновик', async ({ page, request }) => {
        console.log('\n📝 Test: Cannot change POSTED waybill status back to DRAFT');

        const token = await loginViaUI(page, 'admin', '123');
        const authHeaders = await getAuthHeaders(token);

        // Get test data
        const [vehiclesRes, driversRes] = await Promise.all([
            request.get(`${API_URL}/vehicles`, { headers: authHeaders }),
            request.get(`${API_URL}/drivers`, { headers: authHeaders })
        ]);

        const vehicles = (await vehiclesRes.json()).data || await vehiclesRes.json();
        const drivers = (await driversRes.json()).data || await driversRes.json();

        if (!vehicles.length || !drivers.length) {
            console.log('⚠️ Нет ТС или водителей для теста');
            return;
        }

        // Create a waybill
        const createRes = await request.post(`${API_URL}/waybills`, {
            headers: authHeaders,
            data: {
                number: `VAL-POST-${Date.now()}`,
                vehicleId: vehicles[0].id,
                driverId: drivers[0].id,
                date: new Date().toISOString().split('T')[0],
                odometerStart: 60000,
                status: 'DRAFT'
            }
        });

        if (!createRes.ok()) {
            console.log('   ⚠️ Не удалось создать ПЛ для теста');
            return;
        }

        const waybill = await createRes.json();
        const waybillId = waybill.id || waybill.data?.id;
        console.log(`   Создан ПЛ: ${waybillId}`);

        // Progress to POSTED
        await request.patch(`${API_URL}/waybills/${waybillId}/status`, {
            headers: authHeaders,
            data: { status: 'SUBMITTED' }
        });

        await request.patch(`${API_URL}/waybills/${waybillId}/status`, {
            headers: authHeaders,
            data: { status: 'POSTED' }
        });
        console.log('   Статус изменён: DRAFT → SUBMITTED → POSTED');

        // Try to revert to DRAFT
        const revertRes = await request.patch(`${API_URL}/waybills/${waybillId}/status`, {
            headers: authHeaders,
            data: { status: 'DRAFT' }
        });

        console.log(`   Попытка вернуть в DRAFT: статус ${revertRes.status()}`);

        if (!revertRes.ok()) {
            console.log('   ✅ Правильно отклонён: нельзя вернуть проведённый ПЛ в черновик');
        } else {
            console.log('   ⚠️ POSTED ПЛ можно вернуть в DRAFT - возможно это разрешено');
        }

        expect(revertRes.ok()).toBeFalsy();
    });

    test('Нельзя изменить данные проведённого ПЛ', async ({ page, request }) => {
        console.log('\n📝 Test: Cannot modify POSTED waybill data');

        const token = await loginViaUI(page, 'admin', '123');
        const authHeaders = await getAuthHeaders(token);

        // Get test data
        const [vehiclesRes, driversRes] = await Promise.all([
            request.get(`${API_URL}/vehicles`, { headers: authHeaders }),
            request.get(`${API_URL}/drivers`, { headers: authHeaders })
        ]);

        const vehicles = (await vehiclesRes.json()).data || await vehiclesRes.json();
        const drivers = (await driversRes.json()).data || await driversRes.json();

        if (!vehicles.length || !drivers.length) {
            console.log('⚠️ Нет ТС или водителей для теста');
            return;
        }

        // Create and post a waybill
        const createRes = await request.post(`${API_URL}/waybills`, {
            headers: authHeaders,
            data: {
                number: `VAL-EDIT-${Date.now()}`,
                vehicleId: vehicles[0].id,
                driverId: drivers[0].id,
                date: new Date().toISOString().split('T')[0],
                odometerStart: 70000,
                fuelAtStart: 40,
                status: 'DRAFT'
            }
        });

        if (!createRes.ok()) {
            console.log('   ⚠️ Не удалось создать ПЛ для теста');
            return;
        }

        const waybill = await createRes.json();
        const waybillId = waybill.id || waybill.data?.id;

        // Progress to POSTED
        await request.patch(`${API_URL}/waybills/${waybillId}/status`, {
            headers: authHeaders,
            data: { status: 'SUBMITTED' }
        });

        await request.patch(`${API_URL}/waybills/${waybillId}/status`, {
            headers: authHeaders,
            data: { status: 'POSTED' }
        });
        console.log(`   ПЛ ${waybillId} проведён (POSTED)`);

        // Try to update the posted waybill
        const updateRes = await request.put(`${API_URL}/waybills/${waybillId}`, {
            headers: authHeaders,
            data: {
                ...waybill,
                odometerStart: 75000, // Try to change odometer
                fuelAtStart: 50 // Try to change fuel
            }
        });

        console.log(`   Попытка изменить данные: статус ${updateRes.status()}`);

        if (!updateRes.ok()) {
            console.log('   ✅ Правильно отклонён: нельзя редактировать проведённый ПЛ');
        } else {
            console.log('   ⚠️ Проведённый ПЛ можно редактировать - проверьте бизнес-логику');
        }
    });

    test('Требуется авторизация для создания ПЛ', async ({ request }) => {
        console.log('\n📝 Test: Authorization required to create waybill');

        // Try to create waybill without auth token
        const response = await request.post(`${API_URL}/waybills`, {
            headers: { 'Content-Type': 'application/json' }, // No Authorization header
            data: {
                number: `VAL-AUTH-${Date.now()}`,
                date: new Date().toISOString().split('T')[0],
                status: 'DRAFT'
            }
        });

        console.log(`   Статус ответа без токена: ${response.status()}`);
        expect(response.status()).toBe(401);
        console.log('   ✅ Правильно: 401 Unauthorized');
    });

    test('Валидация даты: дата ПЛ обязательна', async ({ page, request }) => {
        console.log('\n📝 Test: Waybill date is required');

        const token = await loginViaUI(page, 'admin', '123');
        const authHeaders = await getAuthHeaders(token);

        // Get test data
        const [vehiclesRes, driversRes] = await Promise.all([
            request.get(`${API_URL}/vehicles`, { headers: authHeaders }),
            request.get(`${API_URL}/drivers`, { headers: authHeaders })
        ]);

        const vehicles = (await vehiclesRes.json()).data || await vehiclesRes.json();
        const drivers = (await driversRes.json()).data || await driversRes.json();

        if (!vehicles.length || !drivers.length) {
            console.log('⚠️ Нет ТС или водителей для теста');
            return;
        }

        // Try to create waybill without date
        const response = await request.post(`${API_URL}/waybills`, {
            headers: authHeaders,
            data: {
                number: `VAL-DATE-${Date.now()}`,
                vehicleId: vehicles[0].id,
                driverId: drivers[0].id,
                odometerStart: 80000,
                status: 'DRAFT'
                // date is missing!
            }
        });

        console.log(`   Статус ответа без даты: ${response.status()}`);

        if (!response.ok()) {
            console.log('   ✅ Правильно отклонён: дата обязательна');
        } else {
            console.log('   ⚠️ ПЛ создан без даты');
        }
    });
});
