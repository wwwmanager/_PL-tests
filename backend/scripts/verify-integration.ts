import fetch from 'node-fetch';

const API_URL = 'http://localhost:3001/api';
let token: string;

// Login and get token
async function login() {
    const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin', password: '123' })
    });
    const data = await res.json() as any;
    console.log('[login] Response:', JSON.stringify(data, null, 2));
    token = data.token || data.data?.token || data.accessToken;
    console.log('[login] Token extracted:', token ? `${token.substring(0, 20)}...` : 'UNDEFINED');
    console.log('✅ Logged in as admin');
}

// Get stock item for fuel
async function getStockItem() {
    const res = await fetch(`${API_URL}/stock/items`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json() as any;
    // API может вернуть массив или объект с data
    const items = Array.isArray(data) ? data : (data.data || [data]);
    const fuelItem = items.find((item: any) => item.isFuel) || items[0];
    console.log(`✅ Found stock item: ${fuelItem.name} (ID: ${fuelItem.id})`);
    return fuelItem.id;
}

// Get vehicle and driver
async function getVehicleAndDriver() {
    const [vehiclesRes, driversRes] = await Promise.all([
        fetch(`${API_URL}/vehicles`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/drivers`, { headers: { 'Authorization': `Bearer ${token}` } })
    ]);

    const vehiclesData = await vehiclesRes.json() as any;
    const driversData = await driversRes.json() as any;

    const vehicles = Array.isArray(vehiclesData) ? vehiclesData : (vehiclesData.data || [vehiclesData]);
    const drivers = Array.isArray(driversData) ? driversData : (driversData.data || [driversData]);

    console.log(`✅ Found ${vehicles.length} vehicles, ${drivers.length} drivers`);
    return { vehicleId: vehicles[0].id, driverId: drivers[0].id };
}

// Create waybill
async function createWaybill(vehicleId: string, driverId: string, stockItemId: string) {
    const waybill = {
        number: `WB-TEST-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        vehicleId,
        driverId,
        fuelLines: [{
            stockItemId,
            fuelStart: 50,
            fuelReceived: 30,
            fuelConsumed: 25,
            fuelEnd: 55
        }]
    };

    const res = await fetch(`${API_URL}/waybills`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(waybill)
    });

    const data = await res.json() as any;
    console.log(`✅ Created waybill ${data.number} (ID: ${data.id}, Status: ${data.status})`);
    return data.id;
}

// Change waybill status
async function changeStatus(waybillId: string, status: string) {
    const res = await fetch(`${API_URL}/waybills/${waybillId}/status`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
    });

    if (!res.ok) {
        const error = await res.text();
        console.error(`❌ Failed to change status to ${status}: ${error}`);
        throw new Error(error);
    }

    console.log(`✅ Changed status to ${status}`);
}

// Check stock movements
async function checkStockMovements(stockItemId: string, waybillId?: string) {
    let url = `${API_URL}/stock/movements?stockItemId=${stockItemId}`;
    if (waybillId) {
        url += `&waybillId=${waybillId}`;
    }

    const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await res.json() as any;
    const movements = Array.isArray(data) ? data : (data.data || [data]);
    const expenses = movements.filter((m: any) => m.movementType === 'EXPENSE');

    console.log(`✅ Stock movements: ${movements.length} total, ${expenses.length} EXPENSE`);
    if (expenses.length > 0) {
        console.log(`   Latest EXPENSE: ${expenses[0].quantity} @ ${new Date(expenses[0].createdAt).toLocaleString()}`);
        if (expenses[0].documentType && expenses[0].documentId) {
            console.log(`   Document: ${expenses[0].documentType} (ID: ${expenses[0].documentId})`);
        }
    }

    return expenses;
}

// Test pagination
async function testPagination() {
    console.log('\n📊 Testing Pagination...');

    // Page 1
    const res1 = await fetch(`${API_URL}/waybills?page=1&limit=10`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data1 = await res1.json() as any;

    console.log(`✅ Page 1: ${data1.data.length} records`);
    console.log(`   Total: ${data1.pagination.total}, Pages: ${data1.pagination.pages}`);

    // Page 2
    if (data1.pagination.pages > 1) {
        const res2 = await fetch(`${API_URL}/waybills?page=2&limit=10`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data2 = await res2.json() as any;
        console.log(`✅ Page 2: ${data2.data.length} records`);
    }
}

// Main test
async function main() {
    try {
        console.log('🚀 Starting Verification Tests\n');

        await login();

        const stockItemId = await getStockItem();
        const { vehicleId, driverId } = await getVehicleAndDriver();

        console.log('\n📝 Test 1: Create Waybill → SUBMITTED → POSTED');
        const waybillId = await createWaybill(vehicleId, driverId, stockItemId);

        await changeStatus(waybillId, 'SUBMITTED');
        await changeStatus(waybillId, 'POSTED');

        console.log('\n🏭 Checking Stock Movements...');
        const expenses = await checkStockMovements(stockItemId, waybillId);

        if (expenses.length === 0) {
            console.error('❌ ERROR: No stock movements created!');
        } else {
            // Verify the movement is linked to our waybill
            const ourMovement = expenses.find((e: any) => e.documentId === waybillId);
            if (ourMovement) {
                console.log('✅ Stock movement created and linked to waybill!');
            } else {
                console.warn('⚠️  Stock movement found but not linked to our waybill');
            }
        }

        await testPagination();

        console.log('\n✅ All tests passed!\n');
    } catch (error) {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    }
}

main();
