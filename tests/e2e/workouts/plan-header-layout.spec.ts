import { expect, test } from '@playwright/test';

for (const appearance of ['light', 'dark']) {
  test(`plan titles use compact headers and leading alignment (${appearance})`, async ({ page }, info) => {
    await page.addInitScript(appearance => {
      localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance }));
      localStorage.setItem('@forge/plans-v1', JSON.stringify({
        standaloneRoutines: [],
        plans: [{
          id: 'compact-plan', name: 'Push', createdAt: Date.now(), updatedAt: Date.now(),
          routines: [{ id: 'compact-routine', planId: 'compact-plan', name: 'Chest', type: 'Strength', exercises: [], createdAt: Date.now(), updatedAt: Date.now() }],
        }],
      }));
    }, appearance);
    await page.goto('/');
    await page.getByRole('tab', { name: 'Plans', exact: true }).click();
    const options = page.getByRole('button', { name: 'Options for Push', exact: true });
    await expect(options).toBeVisible();
    const header = options.locator('..');
    const bounds = (await header.boundingBox())!;
    expect(bounds.height).toBeCloseTo(52, 1);
    expect((await options.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(header.getByText('Push', { exact: true })).toHaveCSS('text-align', 'start');
    await page.waitForTimeout(300);
    await page.screenshot({ path: info.outputPath(`compact-plan-${appearance}.png`) });
    await page.getByRole('tab', { name: 'Settings', exact: true }).click();
    await expect(page.getByTestId('settings-title')).toHaveCSS('text-align', 'start');
  });
}
