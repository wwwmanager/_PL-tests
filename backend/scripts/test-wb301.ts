/**
 * WB-301 Test Script: Verify isWinterDate implementation
 * 
 * Run: npx ts-node scripts/test-wb301.ts
 */

import { isWinterDate } from '../src/utils/dateUtils';
import { SeasonSettings } from '../src/services/settingsService';

console.log('WB-301: Testing isWinterDate implementation\n');

// Test 1: Recurring settings (winter Nov 1 -> summer Apr 1)
const recurringSettings: SeasonSettings = {
    type: 'recurring',
    summerDay: 1,
    summerMonth: 4,    // April
    winterDay: 1,
    winterMonth: 11    // November
};

console.log('Test 1: Recurring settings (winter Nov 1 → summer Apr 1)');

const winterDatesRecurring = [
    { date: '2024-01-15', expectedWinter: true, desc: 'January 15' },
    { date: '2024-02-28', expectedWinter: true, desc: 'February 28' },
    { date: '2024-03-31', expectedWinter: true, desc: 'March 31 (last day before summer)' },
    { date: '2024-11-01', expectedWinter: true, desc: 'November 1 (first day of winter)' },
    { date: '2024-12-25', expectedWinter: true, desc: 'December 25' },
];

const summerDatesRecurring = [
    { date: '2024-04-01', expectedWinter: false, desc: 'April 1 (first day of summer)' },
    { date: '2024-06-15', expectedWinter: false, desc: 'June 15' },
    { date: '2024-08-20', expectedWinter: false, desc: 'August 20' },
    { date: '2024-10-31', expectedWinter: false, desc: 'October 31 (last day before winter)' },
];

let passed = 0;
let failed = 0;

[...winterDatesRecurring, ...summerDatesRecurring].forEach(test => {
    const result = isWinterDate(test.date, recurringSettings);
    const status = result === test.expectedWinter ? '✅' : '❌';
    if (result === test.expectedWinter) {
        passed++;
    } else {
        failed++;
    }
    console.log(`  ${status} ${test.desc}: isWinter=${result} (expected ${test.expectedWinter})`);
});

console.log('');

// Test 2: Manual settings (winter spans New Year)
const manualSettings: SeasonSettings = {
    type: 'manual',
    winterStartDate: '2024-11-01',
    winterEndDate: '2025-03-31'
};

console.log('Test 2: Manual settings (winter 2024-11-01 → 2025-03-31)');

const manualDates = [
    { date: '2024-11-01', expectedWinter: true, desc: 'November 1, 2024 (first day)' },
    { date: '2024-12-15', expectedWinter: true, desc: 'December 15, 2024' },
    { date: '2025-01-10', expectedWinter: true, desc: 'January 10, 2025' },
    { date: '2025-02-28', expectedWinter: true, desc: 'February 28, 2025' },
    { date: '2025-03-31', expectedWinter: true, desc: 'March 31, 2025 (last day)' },
    { date: '2024-10-31', expectedWinter: false, desc: 'October 31, 2024 (before winter)' },
    { date: '2025-04-01', expectedWinter: false, desc: 'April 1, 2025 (after winter)' },
    { date: '2024-07-15', expectedWinter: false, desc: 'July 15, 2024 (summer)' },
];

manualDates.forEach(test => {
    const result = isWinterDate(test.date, manualSettings);
    const status = result === test.expectedWinter ? '✅' : '❌';
    if (result === test.expectedWinter) {
        passed++;
    } else {
        failed++;
    }
    console.log(`  ${status} ${test.desc}: isWinter=${result} (expected ${test.expectedWinter})`);
});

console.log('');

// Test 3: Edge cases
console.log('Test 3: Edge cases');

const edgeCases = [
    { date: '', settings: recurringSettings, expectedWinter: false, desc: 'Empty date string' },
    { date: 'invalid', settings: recurringSettings, expectedWinter: false, desc: 'Invalid date string' },
    { date: '2024-01-15', settings: null as any, expectedWinter: false, desc: 'Null settings' },
];

edgeCases.forEach(test => {
    const result = isWinterDate(test.date, test.settings);
    const status = result === test.expectedWinter ? '✅' : '❌';
    if (result === test.expectedWinter) {
        passed++;
    } else {
        failed++;
    }
    console.log(`  ${status} ${test.desc}: isWinter=${result} (expected ${test.expectedWinter})`);
});

console.log('');
console.log('═══════════════════════════════════════════');
if (failed === 0) {
    console.log(`WB-301: All ${passed} tests PASSED ✅`);
} else {
    console.log(`WB-301: ${passed} passed, ${failed} FAILED ❌`);
    process.exit(1);
}
console.log('═══════════════════════════════════════════');
