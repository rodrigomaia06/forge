import { expect, test } from '@playwright/test';
import { addExerciseFromPicker, replaceClearedSetValue, startBlankWorkout } from '../support/workoutFlow';

test.describe('Core flow: live workout', () => {
  test('reopens Add exercise reliably and persists editable set values', async ({ page }, testInfo) => {
    await startBlankWorkout(page);

    await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
    await expect(page.getByTestId('add-exercise-catalogue')).toBeVisible();
    await page.getByTestId('add-exercise-sheet-surface')
      .getByRole('button', { name: 'Close add exercises' })
      .click();
    await expect(page.getByRole('button', { name: 'Add exercise', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
    await addExerciseFromPicker(page, 'barbell bench press', 'Bench Press, variation');
    await expect(page.getByText('Barbell Bench Press', { exact: true })).toBeVisible();
    await expect(page.getByText('Flat', { exact: true })).toBeVisible();
    await expect(page.getByText('Flat · Barbell', { exact: true })).toHaveCount(0);

    const weight = page.getByLabel('Kg for set 1');
    const reps = page.getByLabel('Reps for set 1');
    await expect(weight).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(weight).toHaveCSS('text-align', 'center');
    await expect(reps).toHaveCSS('text-align', 'center');
    const emptyWeightBackground = await weight.evaluate((input) => getComputedStyle(input).backgroundColor);
    await weight.fill('10');
    await reps.fill('15');
    await expect(weight).toHaveCSS('background-color', emptyWeightBackground);
    await reps.press('Backspace');
    await expect(reps).toHaveValue('1');
    await reps.press('Backspace');
    await expect(reps).toHaveValue('');
    await expect(weight).toHaveValue('10');
    await reps.blur();
    await reps.focus();
    await reps.fill('10');
    await reps.blur();
    await reps.focus();
    await expect.poll(async () => reps.evaluate((input) => {
      const field = input as HTMLInputElement;
      return [field.selectionStart, field.selectionEnd];
    }))
      .toEqual([2, 2]);
    await weight.focus();
    await weight.press('Backspace');
    await expect(weight).toHaveValue('1');
    await weight.press('Backspace');
    await expect(weight).toHaveValue('');
    await expect(reps).toHaveValue('10');
    await weight.blur();
    await weight.focus();
    await weight.fill('60');
    await page.getByRole('checkbox', { name: 'Complete set 1' }).click();
    await expect(page.getByRole('checkbox', { name: 'Set 1 completed' })).toBeVisible();
    if (testInfo.project.name === 'iphone-air') {
      await page.screenshot({ path: testInfo.outputPath('live-workout-entered-set-iphone.png') });
    }

    await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
    await addExerciseFromPicker(page, 'elliptical', 'Elliptical, variation');
    await expect(page.getByText('Elliptical', { exact: true })).toBeVisible();
    await page.waitForTimeout(350);
    await page.goto('/');
    await expect(page.getByLabel('Kg for set 1')).toHaveValue('60');
    await expect(page.getByLabel('Reps for set 1')).toHaveValue('10');
    await expect(page.getByText('Elliptical', { exact: true })).toBeVisible();
    const distance = page.getByLabel('KM for set 1');
    await distance.fill('5');
    await replaceClearedSetValue(distance, '6');
    await expect(distance).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');

    await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
    await addExerciseFromPicker(page, 'assisted dip', 'Dip, Machine · Assisted');
    const assistance = page.getByLabel('Assist Kg for set 1');
    await assistance.fill('40');
    await replaceClearedSetValue(assistance, '35');
    await page.getByRole('button', { name: 'Finish workout' }).click();
  });
});
