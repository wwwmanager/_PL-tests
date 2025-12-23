// STOCK-LEDGER-TEST-PR1-010: Sanity test for PR1 changes
// Tests P0-1 (POST→410), P0-2 (DELETE→405/403), P0-3 (UPDATE system→400)

const BASE_URL = 'http://localhost:3001/api';

// You need to set these env vars or hardcode:
// - AUTH_TOKEN: valid JWT token
// - SYSTEM_MOVEMENT_ID: ID of a system movement (documentType: WAYBILL/FUEL_CARD_RESET/FUEL_CARD_TOPUP)
// - MANUAL_MOVEMENT_ID: ID of a manual movement (documentType: null)

const AUTH_TOKEN = process.env.AUTH_TOKEN || '';
const SYSTEM_MOVEMENT_ID = process.env.SYSTEM_MOVEMENT_ID || '';
const MANUAL_MOVEMENT_ID = process.env.MANUAL_MOVEMENT_ID || '';

interface TestResult {
    test: string;
    expected: string;
    actual: string;
    status: 'PASS' | 'FAIL';
    details?: any;
}

const results: TestResult[] = [];

async function test1_LegacyPOST() {
    console.log('\n🧪 Test 1: P0-1 Legacy POST → 410 Gone');

    try {
        const response = await fetch(`${BASE_URL}/stock/movements`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                stockItemId: 'dummy-id',
                movementType: 'income',
                quantity: 100
            })
        });

        const body = await response.json();

        const passed = response.status === 410 && body.code === 'ENDPOINT_GONE';

        results.push({
            test: 'P0-1: Legacy POST',
            expected: '410 ENDPOINT_GONE',
            actual: `${response.status} ${body.code || 'N/A'}`,
            status: passed ? 'PASS' : 'FAIL',
            details: body
        });

        console.log(`✅ Status: ${response.status}`);
        console.log(`✅ Code: ${body.code}`);
        console.log(`✅ Migration endpoint: ${body.migration?.endpoint}`);
    } catch (error: any) {
        results.push({
            test: 'P0-1: Legacy POST',
            expected: '410 ENDPOINT_GONE',
            actual: `ERROR: ${error.message}`,
            status: 'FAIL',
            details: error
        });
        console.error('❌ Error:', error.message);
    }
}

async function test2_DeleteSystem() {
    console.log('\n🧪 Test 2: P0-2 DELETE system movement → 403');

    if (!SYSTEM_MOVEMENT_ID) {
        console.log('⚠️  SKIPPED: SYSTEM_MOVEMENT_ID not provided');
        results.push({
            test: 'P0-2: DELETE system',
            expected: '403 SYSTEM_MOVEMENT_DELETE_FORBIDDEN',
            actual: 'SKIPPED (no system movement ID)',
            status: 'FAIL'
        });
        return;
    }

    try {
        const response = await fetch(`${BASE_URL}/stock/movements/${SYSTEM_MOVEMENT_ID}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`
            }
        });

        const body = await response.json();

        const passed = response.status === 403 && body.code === 'SYSTEM_MOVEMENT_DELETE_FORBIDDEN';

        results.push({
            test: 'P0-2: DELETE system',
            expected: '403 SYSTEM_MOVEMENT_DELETE_FORBIDDEN',
            actual: `${response.status} ${body.code || 'N/A'}`,
            status: passed ? 'PASS' : 'FAIL',
            details: body
        });

        console.log(`✅ Status: ${response.status}`);
        console.log(`✅ Code: ${body.code}`);
        console.log(`✅ DocumentType: ${body.documentType}`);
    } catch (error: any) {
        results.push({
            test: 'P0-2: DELETE system',
            expected: '403 SYSTEM_MOVEMENT_DELETE_FORBIDDEN',
            actual: `ERROR: ${error.message}`,
            status: 'FAIL',
            details: error
        });
        console.error('❌ Error:', error.message);
    }
}

async function test3_DeleteManual() {
    console.log('\n🧪 Test 3: P0-2 DELETE manual movement → 405');

    if (!MANUAL_MOVEMENT_ID) {
        console.log('⚠️  SKIPPED: MANUAL_MOVEMENT_ID not provided');
        results.push({
            test: 'P0-2: DELETE manual',
            expected: '405 DELETE_METHOD_NOT_ALLOWED',
            actual: 'SKIPPED (no manual movement ID)',
            status: 'FAIL'
        });
        return;
    }

    try {
        const response = await fetch(`${BASE_URL}/stock/movements/${MANUAL_MOVEMENT_ID}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`
            }
        });

        const body = await response.json();

        const passed = response.status === 405 && body.code === 'DELETE_METHOD_NOT_ALLOWED';

        results.push({
            test: 'P0-2: DELETE manual',
            expected: '405 DELETE_METHOD_NOT_ALLOWED',
            actual: `${response.status} ${body.code || 'N/A'}`,
            status: passed ? 'PASS' : 'FAIL',
            details: body
        });

        console.log(`✅ Status: ${response.status}`);
        console.log(`✅ Code: ${body.code}`);
    } catch (error: any) {
        results.push({
            test: 'P0-2: DELETE manual',
            expected: '405 DELETE_METHOD_NOT_ALLOWED',
            actual: `ERROR: ${error.message}`,
            status: 'FAIL',
            details: error
        });
        console.error('❌ Error:', error.message);
    }
}

async function test4_UpdateSystem() {
    console.log('\n🧪 Test 4: P0-3 UPDATE system movement → 400');

    if (!SYSTEM_MOVEMENT_ID) {
        console.log('⚠️  SKIPPED: SYSTEM_MOVEMENT_ID not provided');
        results.push({
            test: 'P0-3: UPDATE system',
            expected: '400 BadRequestError',
            actual: 'SKIPPED (no system movement ID)',
            status: 'FAIL'
        });
        return;
    }

    try {
        const response = await fetch(`${BASE_URL}/stock/movements/${SYSTEM_MOVEMENT_ID}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                quantity: '200.5',
                comment: 'Test update'
            })
        });

        const body = await response.json();

        const passed = response.status === 400 && body.error?.includes('системные движения');

        results.push({
            test: 'P0-3: UPDATE system',
            expected: '400 BadRequestError (системные движения)',
            actual: `${response.status} ${body.error?.substring(0, 50) || 'N/A'}...`,
            status: passed ? 'PASS' : 'FAIL',
            details: body
        });

        console.log(`✅ Status: ${response.status}`);
        console.log(`✅ Error: ${body.error}`);
    } catch (error: any) {
        results.push({
            test: 'P0-3: UPDATE system',
            expected: '400 BadRequestError',
            actual: `ERROR: ${error.message}`,
            status: 'FAIL',
            details: error
        });
        console.error('❌ Error:', error.message);
    }
}

async function runTests() {
    console.log('🚀 STOCK-LEDGER-TEST-PR1-010: PR1 Sanity Tests\n');
    console.log(`Base URL: ${BASE_URL}`);
    console.log(`Auth Token: ${AUTH_TOKEN ? 'Provided ✓' : 'Missing ✗'}`);
    console.log(`System Movement ID: ${SYSTEM_MOVEMENT_ID || 'Not provided'}`);
    console.log(`Manual Movement ID: ${MANUAL_MOVEMENT_ID || 'Not provided'}`);

    await test1_LegacyPOST();
    await test2_DeleteSystem();
    await test3_DeleteManual();
    await test4_UpdateSystem();

    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Results Summary:');
    console.log('='.repeat(60));

    results.forEach(r => {
        const icon = r.status === 'PASS' ? '✅' : '❌';
        console.log(`${icon} ${r.test}`);
        console.log(`   Expected: ${r.expected}`);
        console.log(`   Actual:   ${r.actual}`);
    });

    const passed = results.filter(r => r.status === 'PASS').length;
    const total = results.length;

    console.log('\n' + '='.repeat(60));
    console.log(`Result: ${passed}/${total} tests passed`);
    console.log('='.repeat(60));

    if (passed === total) {
        console.log('\n🎉 All tests PASSED! PR1 is working correctly.');
        process.exit(0);
    } else {
        console.log('\n⚠️  Some tests FAILED. Review the results above.');
        process.exit(1);
    }
}

runTests().catch(console.error);
