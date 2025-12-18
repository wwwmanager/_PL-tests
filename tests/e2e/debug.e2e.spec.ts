import { test, expect } from '@playwright/test';

test('debug - check what page loads', async ({ page }) => {
    console.log('Navigating to baseURL...');
    await page.goto('/');

    // Wait a bit for page to load
    await page.waitForTimeout(3000);

    // Get page title and body text
    const title = await page.title();
    const bodyText = await page.textContent('body');

    console.log('Page title:', title);
    console.log('Body text (first 500 chars):', bodyText?.substring(0, 500));

    // Take screenshot
    await page.screenshot({ path: 'test-results/debug-page-load.png', fullPage: true });

    // Check what's visible
    const hasLoginForm = await page.getByText('Вход в систему').count();
    const hasDashboard = await page.getByText('Панель управления').count();

    console.log('Has login form:', hasLoginForm > 0);
    console.log('Has dashboard:', hasDashboard > 0);

    // This test is just for debugging, always pass
    expect(true).toBeTruthy();
});
