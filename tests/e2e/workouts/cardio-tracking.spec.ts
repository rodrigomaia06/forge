import { expect, test } from '@playwright/test';
import { addExerciseFromPicker, startBlankWorkout } from '../support/workoutFlow';

test('Stairmaster has duration fields after reload', async ({ page }, testInfo) => {
  await startBlankWorkout(page);
  await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
  await page.getByRole('button', { name: 'Filters, 1 active' }).click();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await addExerciseFromPicker(page, 'stairmaster', 'Stairmaster, variation');
  await expect(page.getByLabel('Sec for set 1')).toBeVisible();
  await expect(page.getByLabel('Kg for set 1')).toHaveCount(0);
  await page.getByLabel('Sec for set 1').fill('60');
  await page.waitForTimeout(350);
  await page.goto('/');
  await expect(page.getByLabel('Sec for set 1')).toHaveValue('60');
  await page.waitForTimeout(350);
  await page.screenshot({ path: testInfo.outputPath('stairmaster-duration.png') });
});
