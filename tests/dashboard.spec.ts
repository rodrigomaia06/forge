import { expect, test } from '@playwright/test';

test.describe('Dashboard', () => {
  test('matches the iPhone visual baseline', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('dashboard-header-title')).toBeVisible();
    await expect(page).toHaveScreenshot('dashboard.png', { fullPage: true });
  });

  test('switches calendar scale from the overflow menu and selects a workout day', async ({
    page,
  }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Change calendar view' }).click();
    await expect(page.getByRole('menuitem', { name: 'Week' })).toBeVisible();
    await page.mouse.click(40, 500);
    await expect(page.getByRole('menuitem', { name: 'Week' })).toBeHidden();
    await page.getByRole('button', { name: 'Change calendar view' }).click();
    await page.getByRole('menuitem', { name: 'Week' }).click();
    await expect(page.getByText('Week of August 24')).toBeVisible();

    await page.getByRole('button', { name: /24 August 2026/ }).click();
    await expect(page.getByTestId('calendar-selected-day')).toBeVisible();
  });

  test('gives the dock priority while the calendar view menu is open', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Change calendar view' }).click();
    await expect(page.getByRole('menuitem', { name: 'Week' })).toBeVisible();

    await page.getByRole('tab', { name: 'History' }).click();

    await expect(page.getByText('History', { exact: true })).toBeVisible();
  });
});
