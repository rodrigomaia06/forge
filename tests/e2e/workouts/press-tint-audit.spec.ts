import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

async function held(page: Page, control: Locator, info: TestInfo, name: string, radius: string) {
  await control.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  const joinedSurface = await control.evaluate(node => {
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (style.borderRadius === '22px' && style.height === '44px' && parent.querySelectorAll('button').length === 2) {
        return {
          frostLayers: parent.querySelectorAll('[style*="backdrop-filter"]').length,
          fills: Array.from(parent.querySelectorAll('button')).map(button => getComputedStyle(button).backgroundColor),
        };
      }
    }
    return null;
  });
  if (joinedSurface) {
    expect(joinedSurface.frostLayers).toBe(1);
    expect(joinedSurface.fills).toEqual(['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)']);
  }
  const box = await control.boundingBox();
  const opacity = await control.evaluate(node => getComputedStyle(node).opacity);
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  const layer = control.getByTestId('forge-press-state-layer');
  await expect(layer).toBeVisible();
  await page.waitForTimeout(120);
  await page.screenshot({ path: info.outputPath(`${name}-held.png`) });
  await expect(layer).toHaveCSS('border-radius', radius);
  const tint = await layer.boundingBox();
  expect(tint!.width).toBeCloseTo(box!.width, 0);
  expect(tint!.height).toBeCloseTo(box!.height, 0);
  await expect(control).toHaveCSS('opacity', opacity);
  await page.mouse.move(1, 1);
  await page.mouse.up();
  await expect(layer).toHaveCount(0);
  await page.screenshot({ path: info.outputPath(`${name}-cancelled.png`) });
}

for (const appearance of ['light', 'dark'] as const) {
  test(`${appearance} joined header actions tint their complete segment`, async ({ page }, info) => {
    await page.addInitScript((appearance) => localStorage.setItem('@forge/settings-preferences', JSON.stringify({
      appearance,
      dailyMeasurementDefinitions: [{ id: 'weight', name: 'Body weight', unit: 'kg', icon: 'weight', color: '#4D7B67' }],
    })), appearance);
    await page.goto('/');
    await held(page, page.getByRole('button', { name: 'Edit dashboard', exact: true }), info, 'dashboard-edit', '0px');
    await held(page, page.getByRole('button', { name: 'Start workout', exact: true }), info, 'dashboard-add', '0px');
    await expect(page.getByTestId('dashboard-header-actions')).toHaveCSS('border-radius', '22px');
    await expect(page.getByTestId('dashboard-header-actions')).toHaveCSS('overflow', 'hidden');
    await page.getByRole('tab', { name: 'History', exact: true }).click();
    await held(page, page.getByRole('button', { name: 'Add past workout', exact: true }), info, 'history-add', '0px');
    await held(page, page.getByRole('button', { name: 'Filter', exact: true }), info, 'history-filter', '0px');
    await page.getByRole('tab', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Measurements', exact: true }).click();
    await held(page, page.getByRole('button', { name: 'Edit measurements', exact: true }), info, 'measurement-edit', '0px');
    await held(page, page.getByRole('button', { name: 'Record measurement', exact: true }), info, 'measurement-add', '0px');
    await held(page, page.getByRole('button', { name: 'Back to Settings', exact: true }), info, 'settings-back', '22px');
  });
}

for (const appearance of ['light', 'dark'] as const) {
  test(`${appearance} routine and live joined actions preserve independent targets`, async ({ page }, info) => {
    await page.addInitScript((appearance) => {
      localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance }));
      localStorage.setItem('@forge/plans-v1', JSON.stringify({ plans: [], standaloneRoutines: [{ id: 'routine', name: 'Tint routine', type: 'Strength', createdAt: 1, updatedAt: 1, exercises: [] }] }));
    }, appearance);
    await page.goto('/');
    await page.getByRole('tab', { name: 'Plans', exact: true }).click();
    await held(page, page.getByRole('button', { name: 'Edit plans', exact: true }), info, 'plans-edit', '0px');
    await held(page, page.getByRole('button', { name: 'Create workout, routine, or plan', exact: true }), info, 'plans-add', '0px');
    await page.getByRole('button', { name: 'Routine actions for Tint routine', exact: true }).click();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await held(page, page.getByRole('button', { name: 'Cancel editing routine', exact: true }), info, 'routine-cancel', '0px');
    await held(page, page.getByRole('button', { name: 'Routine options', exact: true }), info, 'routine-options', '0px');
    await page.getByRole('button', { name: 'Cancel editing routine', exact: true }).click();
    await page.getByRole('button', { name: 'Start Tint routine', exact: true }).click();
    await held(page, page.getByRole('button', { name: 'Cancel workout', exact: true }), info, 'live-cancel', '0px');
    await held(page, page.getByRole('button', { name: 'Edit live workout', exact: true }), info, 'live-edit', '0px');
    await expect(page.getByRole('button', { name: 'Finish workout', exact: true })).toBeVisible();
  });

  test(`${appearance} streak steppers clip tint to the pill and disable limits`, async ({ page }, info) => {
    await page.addInitScript((appearance) => {
      localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance }));
      localStorage.setItem('@forge/dashboard-layout-v1', JSON.stringify([{ id: 'streak', kind: 'streak', visible: true }]));
    }, appearance);
    await page.goto('/');
    await page.getByRole('button', { name: 'Edit dashboard', exact: true }).click();
    await page.getByRole('button', { name: 'Streak tile settings', exact: true }).click();
    const decrease = page.getByRole('button', { name: 'Decrease Workouts / week', exact: true });
    const increase = page.getByRole('button', { name: 'Increase Workouts / week', exact: true });
    await held(page, decrease, info, 'stepper-decrease', '0px');
    await held(page, increase, info, 'stepper-increase', '0px');
    await expect(decrease.locator('..')).toHaveCSS('overflow', 'hidden');
    await decrease.click();
    await decrease.click();
    await expect(decrease).toBeDisabled();
    const bounds = await decrease.boundingBox();
    await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
    await page.mouse.down();
    await expect(decrease.getByTestId('forge-press-state-layer')).toHaveCount(0);
    await page.screenshot({ path: info.outputPath('stepper-minimum-disabled.png') });
    await page.mouse.up();
    for (let i = 0; i < 6; i++) await increase.click();
    await expect(increase).toBeDisabled();
    await page.screenshot({ path: info.outputPath('stepper-maximum-disabled.png') });
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('@forge/dashboard-layout-v1')!)[0].settings.weeklyTargetDefault)).toBe(7);
  });
}
