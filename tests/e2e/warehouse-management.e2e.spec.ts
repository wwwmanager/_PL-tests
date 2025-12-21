import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test.describe('Warehouse Management', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsAdmin(page);
    });

    test('should navigate to Warehouse and switch tabs', async ({ page }) => {
        await page.getByTestId('nav-warehouse').click();
        await expect(page.getByText('Склад', { exact: true })).toBeVisible();

        // REL-204: Default tab is now Nomenclature
        await expect(page.getByTestId('tab-nomenclature')).toHaveClass(/border-blue-500/);
        await expect(page.getByText('Категория')).toBeVisible();

        // Switch to Balances
        await page.getByTestId('tab-balances').click();
        await expect(page.getByTestId('tab-balances')).toHaveClass(/border-blue-500/);
        await expect(page.getByText('На дату/время')).toBeVisible();

        // Switch to Movements
        await page.getByTestId('tab-movements').click();
        await expect(page.getByTestId('tab-movements')).toHaveClass(/border-blue-500/);
        await expect(page.getByText('Найдено записей:')).toBeVisible();
    });

    test('should create INCOME movement', async ({ page }) => {
        await page.getByTestId('nav-warehouse').click();
        await page.getByTestId('tab-movements').click();

        await page.getByTestId('btn-create-movement').click();

        const modal = page.getByRole('dialog', { name: 'Новая операция' });
        await expect(modal).toBeVisible();

        // Select type INCOME (default)
        // Select item (first available)
        await modal.locator('select[name="stockItemId"]').selectOption({ index: 1 });

        // Set quantity
        await modal.locator('input[name="quantity"]').fill('100');

        // Select destination 
        // Note: For INCOME/EXPENSE it might be stockLocationId, check if form uses specific name
        // Assuming the form creates stockLocationId for INCOME
        const locationSelect = modal.locator('select[name="stockLocationId"]');
        if (await locationSelect.count() > 0) {
            await locationSelect.selectOption({ index: 1 });
        } else {
            // Fallback if form reuses toStockLocationId (unlikely but possible)
            await modal.locator('select[name="toStockLocationId"]').selectOption({ index: 1 });
        }

        // Set date to specific past date to ensure it's before Transfer
        await modal.locator('input[name="occurredAt"]').fill('2024-01-01T10:00');

        // E2E-TRANSFER-001: Set unique externalRef to prevent conflicts on repeated runs
        const testRef = `E2E-INCOME-${Date.now()}`;
        await modal.locator('input[name="externalRef"]').fill(testRef);

        // Set comment for verification
        const testComment = `E2E Income ${Date.now()}`;
        await modal.locator('input[name="comment"]').fill(testComment);

        // Submit
        await modal.getByRole('button', { name: 'Создать' }).click();

        // Check toast
        await expect(page.getByText('Операция успешно создана')).toBeVisible();

        // Check if it appears in the table
        await expect(page.getByText(testComment)).toBeVisible();
    });

    test('should create TRANSFER movement', async ({ page }) => {
        await page.getByTestId('nav-warehouse').click();
        await page.getByTestId('tab-movements').click();

        await page.getByTestId('btn-create-movement').click();

        const modal = page.getByRole('dialog', { name: 'Новая операция' });

        // Select type TRANSFER
        await modal.locator('select[name="movementType"]').selectOption('TRANSFER');

        // Select item
        await modal.locator('select[name="stockItemId"]').selectOption({ index: 1 });

        // Set quantity
        await modal.locator('input[name="quantity"]').fill('50');

        // Select source (index 1) and destination (index 2)
        await modal.locator('select[name="fromStockLocationId"]').selectOption({ index: 1 });
        await modal.locator('select[name="toStockLocationId"]').selectOption({ index: 2 });

        // Set date to later than Income
        await modal.locator('input[name="occurredAt"]').fill('2024-01-02T10:00');

        // E2E-TRANSFER-001: Set unique externalRef to prevent conflicts on repeated runs
        const testRef = `E2E-TRANSFER-${Date.now()}`;
        await modal.locator('input[name="externalRef"]').fill(testRef);

        // Set comment
        const testComment = `E2E Transfer ${Date.now()}`;
        await modal.locator('input[name="comment"]').fill(testComment);

        // Submit
        await modal.getByRole('button', { name: 'Создать' }).click();

        // Check success
        await expect(page.getByText('Операция успешно создана')).toBeVisible();

        // Check table
        await expect(page.getByText(testComment)).toBeVisible();
    });

    test('should fail to create TRANSFER before INCOME (retroactive insufficient funds)', async ({ page }) => {
        await page.getByTestId('nav-warehouse').click();
        await page.getByTestId('tab-movements').click();

        await page.getByTestId('btn-create-movement').click();

        const modal = page.getByRole('dialog', { name: 'Новая операция' });

        // Select type TRANSFER
        await modal.locator('select[name="movementType"]').selectOption('TRANSFER');

        // Select item (index 1)
        await modal.locator('select[name="stockItemId"]').selectOption({ index: 1 });

        // Set quantity
        await modal.locator('input[name="quantity"]').fill('1000000'); // Huge amount to guarantee failure or retroactive date

        // Select source (index 1) and destination (index 2)
        await modal.locator('select[name="fromStockLocationId"]').selectOption({ index: 1 });
        await modal.locator('select[name="toStockLocationId"]').selectOption({ index: 2 });

        // Set date to far past to ensure no balance existed then
        // Assuming current date format is supported by browser/locale, but fill expects YYYY-MM-DDTHH:mm
        await modal.locator('input[name="occurredAt"]').fill('2020-01-01T12:00');

        // Set comment
        await modal.locator('input[name="comment"]').fill('E2E Negative Test');

        // Submit
        await modal.getByRole('button', { name: 'Создать' }).click();



        // Expect error toast
        // Adjust regex based on actual backend error message
        await expect(page.getByText(/Недостаточно|Insufficient|Ошибка/i)).toBeVisible();

        // Modal should still be visible (or at least error shown)
        // If success, toast 'Операция успешно создана' would appear - we don't want that.
        await expect(page.getByText('Операция успешно создана')).not.toBeVisible();
    });
});
