const { test, expect } = require('@playwright/test');

test.describe('Active workout flow', () => {
  test('starts, records an exercise and finishes a workout', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Start workout' }).click();
    await expect(page.getByText('Workout', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Workout', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Add exercise' }).click();
    await page.getByLabel('Exercise name').fill('Bench press');
    await page.getByRole('button', { name: 'Add exercise', exact: true }).last().click();

    await expect(page.getByText('Bench press', { exact: true })).toBeVisible();
    await page.getByLabel('Weight for set 1').fill('60');
    await page.getByLabel('Reps for set 1').fill('8');
    await page.getByLabel('Complete set 1').click();

    await page.getByRole('button', { name: 'Finish' }).click();
    await expect(page.getByTestId('dashboard-header-title').last()).toBeVisible();
    await expect(page.getByText('Workout', { exact: true })).toBeVisible();
  });

  test('starts the rest timer from the workout header', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Start workout' }).click();

    const restTimer = page.getByRole('button', { name: 'Start rest timer' });
    await expect(restTimer).toBeVisible();
    await restTimer.click();
    await expect(page.getByRole('button', { name: /Rest timer,/ })).toBeVisible();
    await expect(page.getByText(/00:5[0-9]/)).toBeVisible();
  });

  test('navigates between the primary destinations', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'History' }).click();
    await expect(page.getByText('History', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Plans' }).click();
    await expect(page.getByText('Plans', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'More' }).click();
    await expect(page.getByText('More', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Dashboard' }).click();
    await expect(page.getByTestId('dashboard-header-title').last()).toBeVisible();
  });

  test('removes an exercise from its options sheet', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Start workout' }).click();
    await page.getByRole('button', { name: 'Add exercise' }).click();
    await page.getByLabel('Exercise name').fill('Bench press');
    await page.getByRole('button', { name: 'Add exercise', exact: true }).last().click();
    await page.getByRole('button', { name: 'More options for Bench press' }).click();
    await page.getByRole('button', { name: 'Remove Bench press' }).click();
    await expect(page.getByText('Start with an exercise', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add exercise' }).last()).toBeVisible();
  });
});
