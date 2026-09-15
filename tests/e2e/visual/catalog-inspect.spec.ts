import { expect, test } from '@playwright/test';

test('presents imported triceps movements through the Forge hierarchy', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await page.getByTestId('dashboard-workout-source-chooser').getByRole('button', { name: 'Blank workout' }).click();
  await expect(page.getByTestId('add-exercise-catalogue')).toBeVisible();
  await page.waitForTimeout(260);
  const search = page.getByLabel('Search exercises');
  await search.fill('triceps extension');
  await expect(search).toHaveValue('triceps extension');
  await page.waitForTimeout(180);
  const family = page.getByRole('button', { name: /Triceps Extension & \d+ variations/ });
  await expect(family).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('curated-triceps-picker-iphone.png'), fullPage: true });
  await family.click();
  await expect(page.getByRole('button', { name: /Cable & \d+ variations/ })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('curated-triceps-equipment-iphone.png'), fullPage: true });
});

test('finds and selects a curated compound variation from the default workout-type scope', async ({ page }, testInfo) => {
  test.setTimeout(15_000);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await page.getByTestId('dashboard-workout-source-chooser').getByRole('button', { name: 'Blank workout' }).click();

  const catalogue = page.getByTestId('add-exercise-catalogue');
  await expect(catalogue).toBeVisible();
  await page.waitForTimeout(260);
  // A new Strength session starts scoped to Strength, but Filters provides an
  // explicit Clear action for people who want the complete catalogue.
  await expect(page.getByRole('button', { name: /Filters, 1 active/ })).toBeVisible();
  const search = page.getByLabel('Search exercises');
  await search.fill('weighted wide pronated pullups');
  await expect(search).toHaveValue('weighted wide pronated pullups');
  const variation = catalogue.getByRole('checkbox', { name: 'Pull-Up, variation' });
  await expect(variation).toBeVisible();
  await variation.click();
  await page.screenshot({ path: testInfo.outputPath('compound-after-tap-iphone.png'), fullPage: true });
  await expect(variation).toBeChecked();
  if (testInfo.project.name === 'iphone-air') {
    await page.screenshot({ path: testInfo.outputPath('curated-compound-pull-up-iphone.png'), fullPage: true });
  }
  await catalogue.getByRole('button', { name: 'Confirm selected exercises' }).click();
  await expect(page.getByText('Pull-Up', { exact: true })).toBeVisible();
});
