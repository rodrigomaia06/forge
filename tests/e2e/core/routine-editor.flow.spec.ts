import { expect, test } from '@playwright/test';

test.describe('Core flow: routine editor', () => {
  test('keeps routine interval boxes visible, editable after clearing, and persistent', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Plans' }).click();
    await page.getByRole('button', { name: 'Create workout, routine, or plan' }).click();
    await page.getByTestId('plans-creation-popover').getByRole('button', { name: 'New routine' }).click();
    // This field does not accept Playwright's fill() (its value reverts); type
    // real keystrokes so the routine name persists and Save stays enabled.
    const routineName = page.getByLabel('Routine name');
    await routineName.click();
    await routineName.pressSequentially('Core intervals');
    await expect(routineName).toHaveValue('Core intervals');
    await page.getByRole('button', { name: 'Add exercises to routine' }).click();
    // A new routine defaults to Strength, whose initial type scope hides the
    // cardio-only Elliptical from the picker. Clear that scope before searching.
    await expect(page.getByTestId('add-exercise-catalogue')).toBeVisible();
    const initialScope = page.getByRole('button', { name: 'Filters, 1 active' });
    if (!(await initialScope.count())) {
      await initialScope.waitFor({ state: 'visible', timeout: 1500 }).catch(() => {});
    }
    if (await initialScope.count()) {
      await initialScope.click();
      await page.getByRole('button', { name: 'Clear filters' }).click();
      await page.getByRole('button', { name: 'Apply filters' }).click();
    }
    await page.getByLabel('Search exercises').fill('elliptical');
    await page.waitForTimeout(80);
    const elliptical = page.getByRole('checkbox', { name: 'Elliptical, variation' });
    await elliptical.scrollIntoViewIfNeeded();
    await elliptical.click();
    await page.getByRole('button', { name: 'Confirm selected exercises' }).click();

    const exercise = page.getByTestId(/^routine-exercise-/);
    await exercise.getByRole('button', { name: 'Expand Elliptical' }).click();
    const duration = exercise.getByRole('textbox', { name: 'Sec for set 1' });
    await expect(duration).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    if (testInfo.project.use.isMobile === true) {
      await exercise.screenshot({ path: testInfo.outputPath('routine-empty-range-box-iphone.png') });
    }

    await duration.fill('30-60');
    await duration.blur();
    await expect(duration).toHaveValue('30–60');
    await expect(duration).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await duration.fill('');
    await duration.blur();
    await expect(duration).toHaveValue('');
    await duration.focus();
    await duration.fill('45-75');
    await duration.blur();
    await expect(duration).toHaveValue('45–75');

    await page.getByRole('button', { name: 'Save routine' }).click();
    // The static Playwright server has no history fallback for nested native
    // navigation paths, so return to the app root to exercise persistence.
    await page.goto('/');
    await page.getByRole('tab', { name: 'Plans' }).click();
    await expect(page.getByText('Core intervals', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Start Core intervals' }).click();
    await expect(page.getByLabel('Time for set 1, routine interval 45–75')).toBeVisible();
  });
});
