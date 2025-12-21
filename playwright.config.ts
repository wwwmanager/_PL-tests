import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3000);
const BASE_PATH = process.env.E2E_BASE_PATH ?? '/_PL-tests';
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}${BASE_PATH}`;

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

    /* Отключить параллельные тесты для стабильности отладки */
    workers: 1,

    /* Используемый репортер. См. https://playwright.dev/docs/test-reporters */
    reporter: 'list',

    /* Общие настройки для всех проектов ниже. См. https://playwright.dev/docs/api/class-testoptions */
    use: {
        /* Базовый URL для использования в действиях типа `await page.goto('/')`. */
        baseURL: BASE_URL,

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

    /* Веб-сервер для E2E тестов
     * Закомментирован для ручного управления сервером.
     * Запустите `npm run dev -- --port 3000 --strictPort` перед тестами.
     * 
     * webServer: {
     *     command: `npm run dev -- --port ${PORT} --strictPort`,
     *     url: BASE_URL,
     *     reuseExistingServer: true,
     *     timeout: 120_000,
     * },
     */
});
