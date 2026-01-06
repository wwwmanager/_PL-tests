/**
 * SSOT-TESTS: Тесты на совпадение результатов FE и BE расчётов топлива
 * 
 * Эти тесты используют одинаковые фикстуры для проверки, что алгоритмы
 * на фронтенде и бэкенде дают идентичные результаты.
 * 
 * Каноничный алгоритм: services/fuelCalculationService.ts
 * Backend порт: backend/src/domain/waybill/fuel.ts
 */

// ============================================================================
// ФИКСТУРЫ (общие для всех тестов)
// ============================================================================

export const TEST_SEASON_SETTINGS = {
    winterStartMonth: 11,  // Ноябрь
    winterStartDay: 1,
    winterEndMonth: 3,     // Март
    winterEndDay: 31
};

export const TEST_RATES = {
    summerRate: 10,
    winterRate: 12,
    cityIncreasePercent: 10,
    warmingIncreasePercent: 5,
    mountainIncreasePercent: 8
};

export const TEST_ROUTES_SIMPLE = [
    { id: '1', distanceKm: 50, isCityDriving: false, isWarming: false, date: '2024-07-15' },
    { id: '2', distanceKm: 50, isCityDriving: false, isWarming: false, date: '2024-07-15' }
];

export const TEST_ROUTES_WITH_MODIFIERS = [
    { id: '1', distanceKm: 60, isCityDriving: true, isWarming: false, date: '2024-07-15' },
    { id: '2', distanceKm: 40, isCityDriving: false, isWarming: true, date: '2024-07-15' }
];

// ============================================================================
// ОЖИДАЕМЫЕ РЕЗУЛЬТАТЫ
// ============================================================================

/**
 * Тест 1: BOILER летом (100км, норма 10)
 * Алгоритм: (сумма отрезков округлённая / 100) × базовая норма
 * Ожидание: (100 / 100) × 10 = 10.00 л
 */
export const EXPECTED_BOILER_SUMMER = {
    method: 'BOILER' as const,
    date: '2024-07-15',  // Лето
    distance: 100,
    plannedFuel: 10.00
};

/**
 * Тест 2: BOILER зимой (100км, норма 12)
 * Ожидание: (100 / 100) × 12 = 12.00 л
 */
export const EXPECTED_BOILER_WINTER = {
    method: 'BOILER' as const,
    date: '2024-01-15',  // Зима
    distance: 100,
    plannedFuel: 12.00
};

/**
 * Тест 3: SEGMENTS с city +10% (100км суммарно)
 * Отрезок 1: 60км с city → 60/100 × 10 × 1.10 = 6.60
 * Отрезок 2: 40км без модификаторов → 40/100 × 10 × 1.00 = 4.00
 * Итого: округляем каждый отдельно, потом сумму
 * 6.60 + 4.00 = 10.60
 */
export const EXPECTED_SEGMENTS_CITY = {
    method: 'SEGMENTS' as const,
    date: '2024-07-15',
    distance: 100,
    plannedFuel: 10.60  // Реальное значение может отличаться из-за округления на каждом шаге
};

/**
 * Тест 4: SEGMENTS с warming +5% (50км)
 * 50км с warming → 50/100 × 10 × 1.05 = 5.25 л
 */
export const EXPECTED_SEGMENTS_WARMING = {
    method: 'SEGMENTS' as const,
    date: '2024-07-15',
    distance: 50,
    plannedFuel: 5.25
};

/**
 * Тест 5: MIXED (odometer 105км, segments 100км с модификаторами)
 * Шаг 1: Рассчитать расход по сегментам → 10.60 л на 100км
 * Шаг 2: Средняя норма = 10.60 / (100/100) = 10.60 л/100км
 * Шаг 3: Применить к одометру → (105/100) × 10.60 = 11.13 л
 */
export const EXPECTED_MIXED = {
    method: 'MIXED' as const,
    date: '2024-07-15',
    odometerDistance: 105,
    segmentsDistance: 100,
    plannedFuel: 11.13
};

/**
 * Тест 6: Negative case — odometer ≠ sum(routes)
 * Когда пробег по одометру не совпадает с суммой отрезков,
 * BOILER использует сумму отрезков, MIXED — пробег по одометру
 */
export const EXPECTED_DISCREPANCY_CASE = {
    odometerDistance: 120,  // По одометру 120км
    segmentsDistance: 100,  // По отрезкам 100км
    boilerResult: 10.00,    // BOILER: (100/100) × 10
    mixedResult: 12.72      // MIXED: (120/100) × avgRate из segments
};

// ============================================================================
// ТЕСТ-РАННЕРЫ (для использования в Jest/Vitest)
// ============================================================================

/**
 * Проверяет совпадение результата с ожиданием
 * Допустимая погрешность: 0.01 л (из-за округлений)
 */
export function assertFuelResult(actual: number, expected: number, testName: string): boolean {
    const tolerance = 0.01;
    const diff = Math.abs(actual - expected);

    if (diff > tolerance) {
        console.error(`❌ ${testName}: expected ${expected}, got ${actual} (diff: ${diff})`);
        return false;
    }

    console.log(`✅ ${testName}: ${actual} ≈ ${expected}`);
    return true;
}

/**
 * Запускает все тесты на совпадение
 * Вызывайте с результатами FE и BE для сравнения
 */
export function runComparisonTests(
    feResults: { boilerSummer: number; boilerWinter: number; segmentsCity: number; mixed: number },
    beResults: { boilerSummer: number; boilerWinter: number; segmentsCity: number; mixed: number }
): { passed: number; failed: number } {
    let passed = 0;
    let failed = 0;

    const tests = [
        { name: 'BOILER Summer', fe: feResults.boilerSummer, be: beResults.boilerSummer },
        { name: 'BOILER Winter', fe: feResults.boilerWinter, be: beResults.boilerWinter },
        { name: 'SEGMENTS City', fe: feResults.segmentsCity, be: beResults.segmentsCity },
        { name: 'MIXED', fe: feResults.mixed, be: beResults.mixed }
    ];

    for (const test of tests) {
        const tolerance = 0.01;
        const match = Math.abs(test.fe - test.be) <= tolerance;

        if (match) {
            console.log(`✅ FE/BE Match: ${test.name} — FE: ${test.fe}, BE: ${test.be}`);
            passed++;
        } else {
            console.error(`❌ FE/BE Mismatch: ${test.name} — FE: ${test.fe}, BE: ${test.be}`);
            failed++;
        }
    }

    return { passed, failed };
}
