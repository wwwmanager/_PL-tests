import { defineConfig, devices } from '@playwright/test';

/**
 * Конфигурация Playwright для E2E тестов Системы Управления Путевыми Листами
 * См. https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
    testDir: './tests/e2e',

    /* Запускать тесты в файлах параллельно */
    fullyParallel: true,

    /* Ошибка сборки на CI, если случайно оставлен test.only в исходном коде */
    forbidOnly: !!process.env.CI,

    /* Повторные попытки только на CI */
    retries: process.env.CI ? 2 : 0,

    /* Отключить параллельные тесты на CI */
    workers: process.env.CI ? 1 : undefined,

    /* Используемый репортер. См. https://playwright.dev/docs/test-reporters */
    reporter: 'html',

    /* Общие настройки для всех проектов ниже. См. https://playwright.dev/docs/api/class-testoptions */
    use: {
        /* Базовый URL для использования в действиях типа `await page.goto('/')`. */
        baseURL: 'http://localhost:3000/_PL-tests',

        /* Собирать трейс при повторной попытке упавшего теста. См. https://playwright.dev/docs/trace-viewer */
        trace: 'on-first-retry',

        /* Скриншот при ошибке */
        screenshot: 'only-on-failure',

        /* Видео при ошибке */
        video: 'retain-on-failure',
    },

    /* Настройка проектов для основных браузеров */
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    /* 
     * ПРИМЕЧАНИЕ: Backend и Frontend должны быть запущены вручную перед запуском тестов:
     * Терминал 1: cd backend && npm run dev
     * Терминал 2: npm run dev  
     * Терминал 3: npm run test:e2e
     */
});
