import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

async function inspectPress(page: Page, control: Locator, info: TestInfo, name: string, activate = false) {
  await control.scrollIntoViewIfNeeded();
  const bounds = await control.boundingBox();
  if (!bounds) throw new Error('Press target must be visible');
  const opacity = await control.evaluate((node) => getComputedStyle(node).opacity);
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  const layer = control.getByTestId('forge-press-state-layer');
  await expect(layer).toBeVisible();
  const tintBounds = await layer.boundingBox();
  expect(Math.abs(tintBounds!.width - bounds.width)).toBeLessThanOrEqual(4);
  expect(Math.abs(tintBounds!.height - bounds.height)).toBeLessThanOrEqual(4);
  await expect(control).toHaveCSS('opacity', opacity);
  await control.screenshot({ path: info.outputPath(`${name}-pressed.png`) });
  if (!activate) await page.mouse.move(1, 1);
  await page.mouse.up();
  await expect(layer).toHaveCount(0);
}

for (const appearance of ['light', 'dark'] as const) {
  test(`${appearance} whole controls tint in headers, settings, selectors and tabs`, async ({ page }, info) => {
    await page.addInitScript((appearance) => {
      localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance }));
    }, appearance);
    await page.goto('/');
    await inspectPress(page, page.getByRole('button', { name: 'Start workout', exact: true }), info, 'primary-button');
    await inspectPress(page, page.getByRole('tab', { name: 'Settings', exact: true }), info, 'tab');
    await page.getByRole('tab', { name: 'Settings', exact: true }).click();
    await inspectPress(page, page.getByRole('button', { name: 'Workout types', exact: true }), info, 'settings-row');
    await page.getByRole('button', { name: 'Workout types', exact: true }).click();
    await page.getByRole('button', { name: 'Strength workout type', exact: true }).click();
    await inspectPress(page, page.getByRole('button', { name: 'Workout type color', exact: true }), info, 'editor-row');
    await page.getByRole('button', { name: 'Workout type color', exact: true }).click();
    const picker = page.getByTestId('workout-type-color-picker');
    await expect(picker).toBeVisible();
    await inspectPress(page, picker.getByRole('button', { name: 'Close workout type color', exact: true }).last(), info, 'close-circle', true);
    await expect(picker).toHaveCount(0);
    await page.getByRole('button', { name: 'Workout type color', exact: true }).click();
    const preset = picker.getByRole('radio', { name: 'Use Red color', exact: true });
    await inspectPress(page, preset, info, 'colored-swatch', true);
    await inspectPress(page, picker.getByRole('button', { name: 'Apply color #F27D7D', exact: true }), info, 'final-action', true);
  });
}
