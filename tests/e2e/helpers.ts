import { Page } from '@playwright/test';

/**
 * Helper function to perform login
 */
export async function loginAsAdmin(page: Page) {
    await page.goto('/');

    // Wait for the login form heading to ensure page is loaded
    await page.waitForSelector('text=Вход в систему', { timeout: 15000 });

    // Use data-testid for reliable selection (added to Login.tsx)
    await page.getByTestId('login-email').fill('admin@waybills.local');
    await page.getByTestId('login-password').fill('123');

    // Submit form
    await page.getByTestId('login-submit').click();

    // Wait for navigation - the form should disappear or URL should change
    await Promise.race([
        page.waitForSelector('text=Вход в систему', { state: 'hidden', timeout: 10000 }),
        page.waitForTimeout(5000) // Fallback timeout
    ]);

    // Give React time to rerender after login
    await page.waitForTimeout(1000);
}

/**
 * Helper function to navigate to a specific section
 */
export async function navigateToSection(page: Page, sectionName: string) {
    const link = page.getByRole('link', { name: new RegExp(sectionName, 'i') });
    await link.click();
    await page.waitForLoadState('networkidle');
}

/**
 * Helper to generate unique test data
 */
export function generateTestId(prefix: string): string {
    const timestamp = Date.now();
    return `${prefix}-${timestamp}`;
}
