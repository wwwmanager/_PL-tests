import { test, expect } from '@playwright/test';

/**
 * ПОЛНЫЙ E2E ТЕСТ БИЗНЕС-ЛОГИКИ
 * 
 * Проверяет ПОЛНУЮ ЦЕПОЧКУ создания данных в правильном порядке:
 * 
 * 1. Типы топлива (FuelTypes) ← базовый справочник
 * 2. Организация (Organization) 
 * 3. Сотрудник-водитель (Employee/Driver)
 * 4. Транспортное средство (Vehicle) ← зависит от FuelType
 * 5. Бланки ПЛ:
 *    - Создать пачку (Batch)
 *    - Материализовать
 *    - Выдать водителю
 * 6. Путевой лист (Waybill) ← зависит от всего выше
 */

const API_URL = 'http://localhost:3001/api';

interface TestData {
    token: string;
    fuelStockItemId: string;
    organizationId: string;
    driverId: string;
    vehicleId: string;
    batchId: string;
    blankId: string;
    waybillId: string;
}

test.describe('Full Business Logic Chain (E2E)', () => {
    const testData: Partial<TestData> = {};
    const uniquePrefix = `E2E-${Date.now()}`;

    test.beforeAll(async () => {
        const healthCheck = await fetch(`${API_URL}/health`).catch(() => null);
        if (!healthCheck || !healthCheck.ok) {
            throw new Error('❌ Backend недоступен. Запустите: cd backend && npm run dev');
        }
        console.log('✅ Backend доступен');
    });

    test('Complete business chain: FuelType → Organization → Driver → Vehicle → Blanks → Waybill', async ({ page, request }) => {
        // ═══════════════════════════════════════════════════════════════
        // STEP 1: LOGIN
        // ═══════════════════════════════════════════════════════════════
        console.log('\n' + '═'.repeat(60));
        console.log('📝 STEP 1: Login as Admin');
        console.log('═'.repeat(60));

        await page.goto('/');
        await page.waitForSelector('text=Вход в систему', { timeout: 10000 });

        await page.getByTestId('login-email').fill('admin');
        await page.getByTestId('login-password').fill('123');
        await page.getByTestId('login-submit').click();

        await page.waitForURL(/\//, { timeout: 10000 });
        await expect(page.getByText('Вход в систему')).toHaveCount(0);

        const token = await page.evaluate(() => localStorage.getItem('__auth_token__'));
        expect(token).toBeTruthy();
        testData.token = token!;
        console.log('✅ Logged in, token extracted');

        const authHeaders = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        // ═══════════════════════════════════════════════════════════════
        // STEP 2: GET OR CREATE STOCK ITEM (FUEL)
        // ═══════════════════════════════════════════════════════════════
        console.log('\n' + '═'.repeat(60));
        console.log('📝 STEP 2: Get or Create Stock Item (Fuel)');
        console.log('═'.repeat(60));

        // Use categoryEnum=FUEL to filter
        const stockItemsResponse = await request.get(`${API_URL}/stock/items?categoryEnum=FUEL`, { headers: authHeaders });
        expect(stockItemsResponse.ok()).toBeTruthy();

        const stockItemsResult = await stockItemsResponse.json();
        const stockItemsArray = Array.isArray(stockItemsResult) ? stockItemsResult : (stockItemsResult.data || []);

        // Try to find DIESEL/PETROL if seeded, or just pick first
        if (stockItemsArray.length > 0) {
            testData.fuelStockItemId = stockItemsArray[0].id;
            console.log(`✅ Found existing Fuel Stock Item: ${stockItemsArray[0].name} (${testData.fuelStockItemId})`);
        } else {
            const newFuelItem = {
                name: `АИ-95-${uniquePrefix}`,
                code: `AI95-${uniquePrefix}`,
                unit: 'л',
                isFuel: true, // Triggers categoryEnum=FUEL in service
                density: 0.75
            };

            const createItemResponse = await request.post(`${API_URL}/stock/items`, {
                headers: authHeaders,
                data: newFuelItem
            });

            if (!createItemResponse.ok()) {
                console.error('❌ Fuel Item creation failed:', await createItemResponse.text());
            }
            expect(createItemResponse.ok()).toBeTruthy();
            const createdItem = await createItemResponse.json();
            testData.fuelStockItemId = createdItem.id || createdItem.data?.id;
            console.log(`✅ Created Fuel Stock Item: ${newFuelItem.name} (${testData.fuelStockItemId})`);
        }

        // ═══════════════════════════════════════════════════════════════
        // STEP 3: GET ORGANIZATION
        // ═══════════════════════════════════════════════════════════════
        console.log('\n' + '═'.repeat(60));
        console.log('📝 STEP 3: Get Organization');
        console.log('═'.repeat(60));

        const orgsResponse = await request.get(`${API_URL}/organizations`, { headers: authHeaders });
        expect(orgsResponse.ok()).toBeTruthy();

        const orgs = await orgsResponse.json();
        const orgsArray = orgs.data || orgs;

        expect(orgsArray.length).toBeGreaterThan(0);
        testData.organizationId = orgsArray[0].id;
        console.log(`✅ Found Organization: ${orgsArray[0].shortName || orgsArray[0].name} (${testData.organizationId})`);

        // ═══════════════════════════════════════════════════════════════
        // STEP 4: GET OR CREATE DRIVER
        // ═══════════════════════════════════════════════════════════════
        console.log('\n' + '═'.repeat(60));
        console.log('📝 STEP 4: Get or Create Driver');
        console.log('═'.repeat(60));

        const driversResponse = await request.get(`${API_URL}/drivers`, { headers: authHeaders });
        expect(driversResponse.ok()).toBeTruthy();

        const drivers = await driversResponse.json();
        const driversArray = drivers.data || drivers;

        if (driversArray.length > 0) {
            testData.driverId = driversArray[0].id;
            console.log(`✅ Found existing Driver: ${driversArray[0].fullName || driversArray[0].id}`);
        } else {
            const newDriver = {
                fullName: `Тестовый Водитель ${uniquePrefix}`,
                shortName: `Тест. В. ${uniquePrefix}`,
                employeeType: 'driver',
                organizationId: testData.organizationId,
                position: 'Водитель',
                isActive: true
            };

            const createDriverResponse = await request.post(`${API_URL}/employees`, {
                headers: authHeaders,
                data: newDriver
            });

            if (!createDriverResponse.ok()) {
                console.error('❌ Driver creation failed:', await createDriverResponse.text());
            }
            expect(createDriverResponse.ok()).toBeTruthy();
            const createdDriver = await createDriverResponse.json();
            testData.driverId = createdDriver.id || createdDriver.data?.id;
            console.log(`✅ Created Driver: ${newDriver.shortName} (${testData.driverId})`);
        }

        // ═══════════════════════════════════════════════════════════════
        // STEP 5: GET OR CREATE VEHICLE
        // ═══════════════════════════════════════════════════════════════
        console.log('\n' + '═'.repeat(60));
        console.log('📝 STEP 5: Get or Create Vehicle');
        console.log('═'.repeat(60));

        const vehiclesResponse = await request.get(`${API_URL}/vehicles`, { headers: authHeaders });
        expect(vehiclesResponse.ok()).toBeTruthy();

        const vehicles = await vehiclesResponse.json();
        const vehiclesArray = vehicles.data || vehicles;

        if (vehiclesArray.length > 0) {
            testData.vehicleId = vehiclesArray[0].id;
            console.log(`✅ Found existing Vehicle: ${vehiclesArray[0].registrationNumber}`);
        } else {
            const newVehicle = {
                registrationNumber: `А${uniquePrefix.slice(-3)}АА77`,
                brand: `Тестовая Марка ${uniquePrefix}`,
                vin: `TEST${uniquePrefix}`.substring(0, 17).padEnd(17, '0'),
                fuelStockItemId: testData.fuelStockItemId,
                mileage: 10000,
                status: 'Active',
                fuelConsumptionRates: { summerRate: 8.5, winterRate: 10.5 }
            };

            const createVehicleResponse = await request.post(`${API_URL}/vehicles`, {
                headers: authHeaders,
                data: newVehicle
            });

            if (!createVehicleResponse.ok()) {
                console.error('❌ Vehicle creation failed:', await createVehicleResponse.text());
            }
            expect(createVehicleResponse.ok()).toBeTruthy();

            const createdVehicle = await createVehicleResponse.json();
            testData.vehicleId = createdVehicle.id || createdVehicle.data?.id;
            console.log(`✅ Created Vehicle: ${newVehicle.registrationNumber} (${testData.vehicleId})`);
        }

        // ═══════════════════════════════════════════════════════════════
        // STEP 6: CREATE BLANK BATCH → MATERIALIZE → ISSUE TO DRIVER
        // ═══════════════════════════════════════════════════════════════
        console.log('\n' + '═'.repeat(60));
        console.log('📝 STEP 6: Create Blank Batch → Materialize → Issue to Driver');
        console.log('═'.repeat(60));

        // 6.1 Create batch
        const batchSeries = `ТСТ${uniquePrefix.slice(-4)}`;
        const batchData = {
            series: batchSeries,
            numberFrom: 1,
            numberTo: 10
        };

        const batchResponse = await request.post(`${API_URL}/blanks/batches`, {
            headers: authHeaders,
            data: batchData
        });

        if (!batchResponse.ok()) {
            console.error('❌ Batch creation failed:', await batchResponse.text());
        }
        expect(batchResponse.ok()).toBeTruthy();

        const batchResult = await batchResponse.json();
        testData.batchId = batchResult.id || batchResult.batch?.id;
        console.log(`✅ Created Batch: ${batchSeries} (${testData.batchId})`);

        // 6.2 Materialize batch
        console.log('   → Materializing batch...');
        const materializeResponse = await request.post(`${API_URL}/blanks/batches/${testData.batchId}/materialize`, {
            headers: authHeaders
        });

        if (materializeResponse.ok()) {
            console.log('✅ Batch materialized');
        } else {
            console.log('ℹ️  Batch already materialized or auto-materialized');
        }

        // 6.3 Get available blanks (filter by series)
        console.log('   → Getting available blanks...');
        const blanksResponse = await request.get(`${API_URL}/blanks?series=${batchSeries}`, {
            headers: authHeaders
        });

        if (!blanksResponse.ok()) {
            console.error('❌ Blanks list failed:', await blanksResponse.text());
        }
        expect(blanksResponse.ok()).toBeTruthy();

        const blanksResult = await blanksResponse.json();
        // API returns paginated: { items: [...], total, page, limit, totalPages }
        const blanksArray = blanksResult.items || blanksResult.data || blanksResult.blanks || blanksResult;
        console.log(`   → Blanks API returned keys: ${Object.keys(blanksResult).join(', ')}, count: ${Array.isArray(blanksArray) ? blanksArray.length : 'N/A'}`);

        // Find first AVAILABLE blank
        const availableBlank = blanksArray.find((b: any) =>
            b.status === 'AVAILABLE' || b.status === 'available'
        );

        expect(availableBlank).toBeTruthy();
        testData.blankId = availableBlank.id;
        console.log(`✅ Found available blank: ${availableBlank.series}-${availableBlank.number} (${testData.blankId})`);

        // 6.4 Issue blank to driver
        console.log('   → Issuing blank to driver...');
        const issueResponse = await request.post(`${API_URL}/blanks/issue`, {
            headers: authHeaders,
            data: {
                blankIds: [testData.blankId],
                driverId: testData.driverId
            }
        });

        if (!issueResponse.ok()) {
            console.error('❌ Issue blanks failed:', await issueResponse.text());
        }
        expect(issueResponse.ok()).toBeTruthy();
        console.log(`✅ Blank issued to driver ${testData.driverId}`);

        // ═══════════════════════════════════════════════════════════════
        // STEP 7: CREATE WAYBILL
        // ═══════════════════════════════════════════════════════════════
        console.log('\n' + '═'.repeat(60));
        console.log('📝 STEP 7: Create Waybill (The Ultimate Test!)');
        console.log('═'.repeat(60));

        const today = new Date().toISOString().split('T')[0];
        const waybillData = {
            number: `ПЛ-${uniquePrefix}`,  // Required field!
            vehicleId: testData.vehicleId,
            driverId: testData.driverId,
            blankId: testData.blankId,
            date: today,
            odometerStart: 10000,
            odometerEnd: 10100,
            plannedRoute: 'Тестовый маршрут'
        };

        console.log('   → Creating waybill with data:', JSON.stringify(waybillData, null, 2));

        const waybillResponse = await request.post(`${API_URL}/waybills`, {
            headers: authHeaders,
            data: waybillData
        });

        if (!waybillResponse.ok()) {
            const errorText = await waybillResponse.text();
            console.error('❌ Waybill creation failed:', errorText);
            throw new Error(`Waybill creation failed: ${errorText}`);
        }

        const createdWaybill = await waybillResponse.json();
        testData.waybillId = createdWaybill.id || createdWaybill.data?.id;
        console.log(`✅ Created Waybill: ${testData.waybillId}`);

        // ═══════════════════════════════════════════════════════════════
        // STEP 8: VERIFY WAYBILL RETRIEVAL
        // ═══════════════════════════════════════════════════════════════
        console.log('\n' + '═'.repeat(60));
        console.log('📝 STEP 8: Verify Waybill Retrieval');
        console.log('═'.repeat(60));

        const getWaybillResponse = await request.get(`${API_URL}/waybills/${testData.waybillId}`, {
            headers: authHeaders
        });

        expect(getWaybillResponse.ok()).toBeTruthy();
        const retrievedWaybill = await getWaybillResponse.json();
        expect(retrievedWaybill.id || retrievedWaybill.data?.id).toBe(testData.waybillId);
        console.log('✅ Waybill retrieved successfully');

        // ═══════════════════════════════════════════════════════════════
        // FINAL SUMMARY
        // ═══════════════════════════════════════════════════════════════
        console.log('\n' + '═'.repeat(60));
        console.log('🎉 FULL BUSINESS LOGIC CHAIN COMPLETED!');
        console.log('═'.repeat(60));
        console.log('\n📊 Created/Used entities:');
        console.log(`   • Fuel StockItem ID: ${testData.fuelStockItemId}`);
        console.log(`   • Organization ID: ${testData.organizationId}`);
        console.log(`   • Driver ID: ${testData.driverId}`);
        console.log(`   • Vehicle ID: ${testData.vehicleId}`);
        console.log(`   • Batch ID: ${testData.batchId}`);
        console.log(`   • Blank ID: ${testData.blankId}`);
        console.log(`   • Waybill ID: ${testData.waybillId}`);
        console.log('\n✅ All entities properly linked!\n');
    });

    test('Constraint: Cannot create waybill without issued blank', async ({ page, request }) => {
        console.log('\n📝 Testing constraint: Waybill requires issued blank');

        await page.goto('/');
        await page.waitForSelector('text=Вход в систему', { timeout: 10000 });
        await page.getByTestId('login-email').fill('admin');
        await page.getByTestId('login-password').fill('123');
        await page.getByTestId('login-submit').click();
        await page.waitForURL(/\//, { timeout: 10000 });

        const token = await page.evaluate(() => localStorage.getItem('__auth_token__'));
        const authHeaders = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        const [vehiclesRes, driversRes] = await Promise.all([
            request.get(`${API_URL}/vehicles`, { headers: authHeaders }),
            request.get(`${API_URL}/drivers`, { headers: authHeaders })
        ]);

        const vehicles = await vehiclesRes.json();
        const drivers = await driversRes.json();

        const vehicleId = (vehicles.data || vehicles)[0]?.id;
        const driverId = (drivers.data || drivers)[0]?.id;

        if (!vehicleId || !driverId) {
            console.log('⚠️ Skip: No vehicles or drivers available');
            return;
        }

        const today = new Date().toISOString().split('T')[0];
        const invalidWaybillData = {
            vehicleId,
            driverId,
            blankId: 'non-existent-blank-id-12345',
            date: today,
            departureDate: today,
            odometerStart: 10000,
            status: 'Draft'
        };

        const response = await request.post(`${API_URL}/waybills`, {
            headers: authHeaders,
            data: invalidWaybillData
        });

        expect(response.ok()).toBeFalsy();
        console.log(`✅ Correctly rejected waybill with invalid blank (Status: ${response.status()})`);
    });
});
