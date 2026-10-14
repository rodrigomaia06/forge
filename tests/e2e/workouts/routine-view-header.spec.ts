import { expect, test } from '@playwright/test';

for (const appearance of ['light', 'dark']) {
  test(`routine visualization has options and joined headers share one surface (${appearance})`, async ({ page }, info) => {
    await page.addInitScript(appearance => {
      localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance }));
      localStorage.setItem('@forge/plans-v1', JSON.stringify({ plans: [], standaloneRoutines: [{
        id: 'header-routine', name: 'Header routine', type: 'Strength', createdAt: 1, updatedAt: 1, exercises: [],
      }] }));
    }, appearance);
    await page.goto('/');
    const group = page.getByTestId('dashboard-header-actions');
    await expect(group).toBeVisible();
    await expect(group.locator('[style*="backdrop-filter"]')).toHaveCount(1);
    const buttons = group.getByRole('button');
    expect(await buttons.evaluateAll(nodes => nodes.map(node => getComputedStyle(node).backgroundColor))).toEqual(['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)']);
    await expect.poll(() => group.evaluate(node => {
      for (let parent: Element | null = node; parent; parent = parent.parentElement) {
        if (Number(getComputedStyle(parent).opacity) < 0.99) return false;
      }
      return true;
    })).toBe(true);
    await group.screenshot({ path: info.outputPath(`joined-header-${appearance}.png`) });
    await page.getByRole('tab', { name: 'Plans', exact: true }).click();
    await page.getByRole('button', { name: 'Routine actions for Header routine', exact: true }).click();
    await page.getByRole('button', { name: 'Visualize', exact: true }).click();
    const options = page.getByRole('button', { name: 'Routine options', exact: true });
    await expect(options).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit routine', exact: true })).toHaveCount(0);
    await page.screenshot({ path: info.outputPath(`routine-view-${appearance}.png`) });
    await options.click();
    const sheet = page.getByTestId('routine-options-sheet');
    await expect(sheet.getByRole('button', { name: 'Share routine', exact: true })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Delete routine', exact: true })).toBeVisible();
    await sheet.getByRole('button', { name: 'Edit routine', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Save routine', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add exercises to routine', exact: true })).toBeVisible();
  });
}
