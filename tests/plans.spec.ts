import { expect, test } from '@playwright/test';

test.describe('Plans and routines', () => {
  test('routes the Dashboard creation action into the Plans creation popover', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Start workout' }).click();
    await expect(page.getByText('Plans', { exact: true })).toBeVisible();
    await expect(page.getByTestId('plans-creation-popover')).toBeVisible();
    await expect(page.getByTestId('plans-creation-popover').getByRole('button', { name: 'New workout', exact: true })).toBeVisible();
  });

  test('starts a blank workout and creates a plan from the header popover', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Plans' }).click();
    await page.getByRole('button', { name: 'Create workout, routine, or plan' }).click();
    await page.getByTestId('plans-creation-popover').getByRole('button', { name: 'New workout plan', exact: true }).click();
    await expect(page.getByText('New plan', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Create workout, routine, or plan' }).click();
    await page.getByTestId('plans-creation-popover').getByRole('button', { name: 'New workout', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Finish workout' })).toBeVisible();
  });

  test('creates a routine, edits it, and starts it as a workout', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Plans' }).click();
    await page.getByRole('button', { name: 'Create workout, routine, or plan' }).click();
    const menu = page.getByTestId('plans-creation-popover');
    await expect(menu.getByRole('button', { name: 'New workout', exact: true })).toBeVisible();
    await expect(menu.getByRole('button', { name: 'New routine', exact: true })).toBeVisible();
    await expect(menu.getByRole('button', { name: 'New workout plan', exact: true })).toBeVisible();
    await menu.getByRole('button', { name: 'New routine', exact: true }).click();
    await expect(page.getByText('Edit routine')).toBeVisible();
    await page.getByLabel('Routine name').fill('Upper body');
    await page.getByRole('button', { name: 'Back to Plans' }).click();
    await expect(page.getByText('Upper body')).toBeVisible();
    await page.getByRole('button', { name: 'Start Upper body' }).click();
    await expect(page.getByLabel('Finish workout')).toBeVisible();
  });
});
