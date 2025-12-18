/**
 * WB-302 Test Script: Verify fuel calculation functions
 * 
 * Run: npx ts-node scripts/test-wb302.ts
 */

import {
    calculateDistanceKm,
    calculateNormConsumption,
    calculatePlannedFuel,
    calculateFuelEnd,
    validateFuelBalance,
    validateOdometer
} from '../src/domain/waybill/fuel';

console.log('WB-302: Testing fuel calculation functions\n');

let passed = 0;
let failed = 0;

function test(name: string, actual: any, expected: any) {
    const isEqual = JSON.stringify(actual) === JSON.stringify(expected);
    if (isEqual) {
        passed++;
        console.log(`  ✅ ${name}`);
    } else {
        failed++;
        console.log(`  ❌ ${name}`);
        console.log(`     Expected: ${JSON.stringify(expected)}`);
        console.log(`     Actual:   ${JSON.stringify(actual)}`);
    }
}

// ============= calculateDistanceKm =============
console.log('Test: calculateDistanceKm');
test('normal case', calculateDistanceKm(1000, 1050), 50);
test('zero distance', calculateDistanceKm(1000, 1000), 0);
test('null start', calculateDistanceKm(null, 1050), null);
test('null end', calculateDistanceKm(1000, null), null);
test('negative distance returns null', calculateDistanceKm(1050, 1000), null);
console.log('');

// ============= calculateNormConsumption =============
console.log('Test: calculateNormConsumption');
test('simple case (100km, rate 10)', calculateNormConsumption(100, 10, {}), 10);
test('winter coefficient 10%', calculateNormConsumption(100, 10, { winter: 0.1 }), 11);
test('combined winter 10% + city 5%', calculateNormConsumption(100, 20, { winter: 0.1, city: 0.05 }), 23);
test('zero distance', calculateNormConsumption(0, 15, { winter: 0.1 }), 0);
test('rounds to 2 decimals (123km, rate 10.5)', calculateNormConsumption(123, 10.5, {}), 12.92);
test('city + warming', calculateNormConsumption(50, 10, { city: 0.15, warming: 0.1 }), 6.25);
console.log('');

// ============= calculatePlannedFuel =============
console.log('Test: calculatePlannedFuel');
const rates = { winterRate: 12, summerRate: 10, cityIncreasePercent: 15, warmingIncreasePercent: 10 };
test('summer rate without flags', calculatePlannedFuel(100, rates, {}, false), 10);
test('winter rate without flags', calculatePlannedFuel(100, rates, {}, true), 12);
test('summer with city flag', calculatePlannedFuel(100, rates, { isCityDriving: true }, false), 11.5);
test('winter with warming flag', calculatePlannedFuel(100, rates, { isWarming: true }, true), 13.2);
test('all flags combined (summer)', calculatePlannedFuel(100, rates, { isCityDriving: true, isWarming: true }, false), 12.5);
test('null rates', calculatePlannedFuel(100, null, {}, false), 0);
test('empty rates', calculatePlannedFuel(100, {}, {}, false), 0);
console.log('');

// ============= calculateFuelEnd =============
console.log('Test: calculateFuelEnd');
test('normal case: 50 + 30 - 25 = 55', calculateFuelEnd(50, 30, 25), 55);
test('null values treated as 0', calculateFuelEnd(null, null, null), 0);
test('only start', calculateFuelEnd(50, null, null), 50);
test('rounding to 2 decimals', calculateFuelEnd(10.115, 5.225, 3.333), 12.01);
console.log('');

// ============= validateFuelBalance =============
console.log('Test: validateFuelBalance');
const valid = validateFuelBalance(50, 30, 25, 55);
test('valid balance', valid.isValid, true);
const invalid = validateFuelBalance(50, 30, 25, 60);
test('invalid balance detected', invalid.isValid, false);
test('within tolerance (0.05)', validateFuelBalance(50, 30, 25, 55.04).isValid, true);
test('outside tolerance', validateFuelBalance(50, 30, 25, 55.1).isValid, false);
const allNull = validateFuelBalance(null, null, null, null);
test('all null is valid', allNull.isValid, true);
console.log('');

// ============= validateOdometer =============
console.log('Test: validateOdometer');
test('valid odometer', validateOdometer(1000, 1050).isValid, true);
test('equal odometer', validateOdometer(1000, 1000).isValid, true);
test('invalid odometer (end < start)', validateOdometer(1050, 1000).isValid, false);
test('null values skip validation', validateOdometer(null, null).isValid, true);
console.log('');

// ============= Summary =============
console.log('═══════════════════════════════════════════');
if (failed === 0) {
    console.log(`WB-302: All ${passed} tests PASSED ✅`);
} else {
    console.log(`WB-302: ${passed} passed, ${failed} FAILED ❌`);
    process.exit(1);
}
console.log('═══════════════════════════════════════════');
