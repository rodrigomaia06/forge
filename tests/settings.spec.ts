import { expect, test } from '@playwright/test';

test.describe('Settings', () => {
  async function openWorkoutTypes(page: import('@playwright/test').Page): Promise<void> {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Workout types' }).click();
  }

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
    await expect(page.getByTestId('workout-type-visibility-bottom-divider')).toBeVisible();
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

  test('keeps a new workout type as a draft until Save', async ({ page }) => {
    await openWorkoutTypes(page);
    await expect(page.getByText('New type', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Add workout type' }).click();
    await expect(page.getByText('New workout type', { exact: true })).toBeVisible();
    const titleBox = await page.getByTestId('new-workout-type-title-wrap').boundingBox();
    const saveBox = await page.getByRole('button', { name: 'Save workout type' }).boundingBox();
    expect(titleBox).not.toBeNull();
    expect(saveBox).not.toBeNull();
    expect((titleBox?.x ?? 0) + (titleBox?.width ?? 0)).toBeLessThanOrEqual(saveBox?.x ?? 0);
    await page.getByRole('button', { name: 'Cancel new workout type' }).click();
    await expect(page.getByText('New type', { exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'Add workout type' }).click();
    await page.getByLabel('Workout type name').fill('   ');
    await expect(page.getByRole('button', { name: 'Save workout type' })).toBeDisabled();
    await expect(page.getByText('New workout type', { exact: true })).toBeVisible();
    await page.getByLabel('Workout type name').fill('Recovery');
    await page.getByRole('button', { name: 'Choose custom workout type color' }).click();
    await expect(page.getByTestId('custom-workout-type-color-picker')).toBeVisible();
    await page
      .getByRole('button', { name: /Use custom color #/ })
      .first()
      .click();
    await expect(page.getByTestId('custom-workout-type-color-picker')).toHaveCount(0);
    await page.getByRole('button', { name: 'Save workout type' }).click();
    await expect(page.getByRole('button', { name: 'Recovery workout type' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Recovery workout type' })).toHaveCount(1);
  });

  test('guards a changed workout type draft on Cancel', async ({ page }) => {
    await openWorkoutTypes(page);
    await page.getByRole('button', { name: 'Add workout type' }).click();
    await page.getByLabel('Workout type name').fill('Recovery');
    await page.getByRole('button', { name: 'Cancel new workout type' }).click();
    await expect(page.getByText('New workout type', { exact: true })).toBeVisible();
  });
});
