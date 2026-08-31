import { expect, test } from '@playwright/test';

async function openAllExercises(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Exercises' }).click();
  await page.getByRole('button', { name: 'All exercises, 21 exercises' }).click();
}

test.describe('Exercise library', () => {
  test('groups movement variations and applies multi-select facets', async ({ page }) => {
    await openAllExercises(page);
    await expect(page.getByTestId('settings-detail-title').last()).toHaveText('All exercises');
    await expect(page.getByRole('button', { name: 'Bench Press, 4 variations' })).toBeVisible();
    await page.getByRole('button', { name: 'Bench Press, 4 variations' }).click();
    await expect(page.getByText('Close grip', { exact: true })).toBeVisible();

    await page.getByLabel('Search exercises').fill('Pec Deck');
    await expect(page.getByRole('button', { name: 'Open Pec Deck' })).toBeVisible();

    await page.getByRole('button', { name: 'Filters' }).click();
    await page.getByRole('checkbox', { name: 'Machine', exact: true }).click();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('button', { name: 'Remove Machine filter' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear all filters' }).click();
  });

  test('creates and persists a custom movement', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Exercises' }).click();
    await page.getByRole('button', { name: 'Custom exercises, 0 exercises' }).click();
    await page.getByRole('button', { name: 'Create custom exercise' }).click();
    await page.getByLabel('Exercise name').fill('Cable Press Around');
    await page.getByRole('button', { name: 'Save variation' }).click();
    await expect(
      page.getByRole('button', { name: 'Open Cable Press Around' }),
    ).toBeVisible();
  });
});
