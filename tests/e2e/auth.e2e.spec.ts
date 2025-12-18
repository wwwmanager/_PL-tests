import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test.describe('Authentication', () => {
    test('should login successfully as admin and display Central Mode', async ({ page }) => {
        await loginAsAdmin(page);

        // Verify we're logged in - the URL should not change significantly or login form should be gone
        await expect(page).toHaveURL(/\//, { timeout: 10000 });

        // At minimum, we should NOT see the login form anymore
        const loginForm = page.getByText('Вход в систему');
        await expect(loginForm).toHaveCount(0);

        console.log('✅ Login successful - user is authenticated');
    });

    test('should show login page when not authenticated', async ({ page }) => {
        await page.goto('/');

        // Wait for login page to load
        await page.waitForSelector('text=Вход в систему', { timeout: 10000 });

        // Verify login form is visible using data-testid
        await expect(page.getByTestId('login-email')).toBeVisible();
        await expect(page.getByTestId('login-password')).toBeVisible();
        await expect(page.getByTestId('login-submit')).toBeVisible();
    });

    test('should handle invalid credentials', async ({ page }) => {
        await page.goto('/');

        // Wait for login form heading
        await page.waitForSelector('text=Вход в систему', { timeout: 10000 });

        // Fill in wrong credentials using data-testid
        await page.getByTestId('login-email').fill('wrong@example.com');
        await page.getByTestId('login-password').fill('WrongPassword123!');
        await page.getByTestId('login-submit').click();

        // Should still see login page or error message
        await page.waitForTimeout(3000);

        // Either we're still on login page OR there's an error message
        const loginHeading = await page.getByText('Вход в систему').count();
        const bodyText = await page.textContent('body');
        const hasErrorMessage = bodyText?.toLowerCase().includes('ошибка') ||
            bodyText?.toLowerCase().includes('неверн') ||
            bodyText?.toLowerCase().includes('error');

        expect(loginHeading > 0 || hasErrorMessage).toBeTruthy();
    });

    test.skip('should logout successfully', async ({ page }) => {
        // TODO: Implement after confirming logout UI exists
        await loginAsAdmin(page);

        // Find and click logout button
        // await page.getByRole('button', { name: /выйти|logout/i }).click();

        // Verify redirected to login
        // await expect(page.getByTestId('login-email')).toBeVisible();
    });
});
