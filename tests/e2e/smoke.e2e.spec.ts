import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
    test('app boots under basePath', async ({ page }) => {
        // Navigate to root (which is baseURL)
        await page.goto('/');

        // Wait for app to load
        await page.waitForTimeout(2000);

        // Check that we don't see the Vite "Did you mean..." message
        await expect(page.locator('body')).not.toContainText('Вы имели в виду /_PL-tests');
        await expect(page.locator('body')).not.toContainText('Did you mean');

        // Basic check that something rendered
        await expect(page.locator('body')).not.toBeEmpty();
    });

    test('login page accessible via relative path', async ({ page }) => {
        // Navigate to login using relative path (relies on baseURL)
        await page.goto('/');

        // Should see login form
        await expect(page.getByText('Вход в систему')).toBeVisible({ timeout: 10000 });

        // Verify login form elements exist
        await expect(page.getByTestId('login-email')).toBeVisible();
        await expect(page.getByTestId('login-password')).toBeVisible();
        await expect(page.getByTestId('login-submit')).toBeVisible();
    });
});
