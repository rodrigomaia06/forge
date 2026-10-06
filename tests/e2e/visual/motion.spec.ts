import { expect, test } from '@playwright/test';

test.describe('Forge motion contract', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.use.isMobile !== true, 'Motion visual acceptance uses the configured phone profiles.');
  });

  test('keeps tab feedback and shared-sheet replacement responsive', async ({ page }) => {
    await page.goto('/');
    const dock = page.getByTestId('dashboard-dock-cylinder');
    await expect(dock).toBeVisible();

    await page.getByRole('tab', { name: 'Plans' }).click();
    await expect(page.getByText('Plans', { exact: true })).toBeVisible({ timeout: 300 });
    await expect(page.getByTestId('dashboard-nav-selection-pill')).toBeVisible();

    await page.getByRole('tab', { name: 'History' }).click();
    await page.getByRole('button', { name: 'Add past workout' }).click();
    await expect(page.getByTestId('historical-workout-source-chooser')).toBeVisible({ timeout: 300 });
    await page.getByRole('button', { name: 'Blank workout' }).click();
    await expect(page.getByLabel('Workout name')).toBeVisible({ timeout: 300 });
  });

  test('settles state changes immediately with system Reduce Motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    await page.getByRole('tab', { name: 'History' }).click();
    await page.getByRole('button', { name: 'Add past workout' }).click();
    const chooser = page.getByTestId('historical-workout-source-chooser');
    await expect(chooser).toBeVisible({ timeout: 100 });
    await expect.poll(async () => chooser.evaluate((element) => {
      const transform = getComputedStyle(element).transform;
      const matrix = transform === 'none' ? new DOMMatrix() : new DOMMatrix(transform);
      return Math.abs(matrix.m42) < 0.1 && Math.abs(matrix.m41) < 0.1;
    }), { timeout: 100 }).toBe(true);
  });
});
