import { expect, test } from '@playwright/test';

test.describe('Settings', () => {
  test('shows grouped settings and opens each destination', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();

    await expect(page.getByTestId('settings-title')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Exercises' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Workout types' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'General' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Backup & Export' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Logs' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'About' })).toBeVisible();

    await page.getByRole('button', { name: 'Exercises' }).click();
    await expect(page.getByTestId('settings-detail-title')).toHaveText('Exercises');
    await expect(page.getByRole('button', { name: 'All exercises, 21 exercises' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Strength, 21 exercises' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mobility, 0 exercises' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cardio, 0 exercises' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Court sport, 0 exercises' })).toBeVisible();
    await page.getByRole('button', { name: 'Strength, 21 exercises' }).click();
    await expect(page.getByTestId('settings-detail-title').last()).toHaveText('Strength');
    await page.getByRole('button', { name: 'Back to Exercises' }).click();
    await page.getByRole('button', { name: 'Back to Settings' }).click();
    await expect(page.getByTestId('settings-title')).toBeVisible();

    await page.getByRole('button', { name: 'Workout types' }).click();
    await expect(page.getByTestId('settings-detail-title')).toHaveText('Workout types');
    await page.getByRole('button', { name: 'Strength workout type' }).click();
    await expect(
      page.getByRole('switch', { name: 'Hide Strength in workout pickers' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Back to Settings' }).click();

    await page.getByRole('button', { name: 'Backup & Export' }).click();
    await expect(page.getByTestId('settings-detail-title')).toHaveText('Backup & Export');
    await page.getByRole('button', { name: 'Back to Settings' }).click();

    await page.getByRole('button', { name: 'Logs' }).click();
    await expect(page.getByTestId('settings-detail-title')).toHaveText('Logs');
    await page.getByRole('button', { name: 'Back to Settings' }).click();

    await page.getByRole('button', { name: 'About' }).click();
    await expect(page.getByTestId('settings-detail-title')).toHaveText('About');
  });

  test('persists the first day of the week and applies it to the Calendar', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'General' }).click();
    await page.getByRole('radio', { name: 'Sunday' }).click();
    await page.getByRole('button', { name: 'Back to Settings' }).click();
    await expect(page.getByRole('button', { name: 'General' })).toBeVisible();

    await page.getByRole('tab', { name: 'Dashboard' }).click();
    await expect(page.locator('[data-testid="calendar-selected-day"]').last()).toBeVisible();
    await expect(page.getByTestId('calendar-weekdays').last()).toHaveText('SMTWTFS');
    await page.reload();
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'General' }).click();
    await expect(page.getByRole('radio', { name: 'Sunday' })).toBeVisible();
  });
});
