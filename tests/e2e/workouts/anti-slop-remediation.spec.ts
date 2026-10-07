import { expect, test, type Page, type TestInfo } from '@playwright/test';

async function capture(page: Page, info: TestInfo, state: string) {
  await page.waitForTimeout(600);
  await page.screenshot({ path: info.outputPath(`${state}.png`) });
}

async function seed(page: Page, appearance: 'light' | 'dark') {
  await page.addInitScript((appearance) => {
    const date = new Date().toLocaleDateString('en-CA');
    localStorage.setItem('@forge/settings-preferences', JSON.stringify({
      appearance,
      dailyMeasurementDefinitions: [{ id: 'weight', name: 'Body weight', unit: 'kg', icon: 'weight', color: '#4D7B67' }],
      dailyMeasurementEntries: [{ id: 'entry', definitionId: 'weight', date, value: 80 }],
    }));
  }, appearance);
}

async function settings(page: Page, destination: string) {
  await page.getByRole('tab', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: destination, exact: true }).click();
}

for (const appearance of ['light', 'dark'] as const) {
  for (const collection of ['plans', 'history', 'active', 'invalid-plan', 'invalid-workout'] as const) {
    test(`${appearance} preserves corrupt ${collection} and retries hydration`, async ({ page }, info) => {
      await seed(page, appearance);
      const key = collection === 'plans' || collection === 'invalid-plan' ? '@forge/plans-v1' : collection === 'active' ? '@forge/active-workout' : '@forge/completed-workouts';
      const raw = collection === 'invalid-plan' ? '{"plans":[null],"standaloneRoutines":[]}' : collection === 'invalid-workout' ? '[null]' : '{broken';
      await page.addInitScript(({ key, raw }) => { localStorage.setItem(key, raw); }, { key, raw });
      await page.goto('/');
      await expect(page.getByRole('alert')).toContainText('Could not load saved');
      await expect(page.getByText('Build your first routine')).toHaveCount(0);
      await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), key)).toBe(raw);
      await page.getByRole('button', { name: 'Retry loading data' }).click();
      await expect(page.getByRole('alert')).toBeVisible();
      await capture(page, info, `corrupt-${collection}-${appearance}`);
      expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(raw);
      await page.getByRole('button', { name: 'Open Backup & Export' }).click();
      await expect(page.getByTestId('settings-detail-title')).toHaveText('Backup & Export');
      await page.getByRole('button', { name: 'Back to Settings' }).click();
      await page.evaluate(({ key, collection }) => {
        localStorage.setItem(key, collection === 'plans' || collection === 'invalid-plan' ? '{"plans":[],"standaloneRoutines":[]}' : collection === 'active' ? 'null' : '[]');
      }, { key, collection });
      await page.getByRole('button', { name: 'Retry loading data' }).click();
      await expect(page.getByRole('tab', { name: 'Plans', exact: true })).toBeVisible();
    });
  }

  test(`${appearance} measurement failure card retains draft, retries, and persists`, async ({ page }, info) => {
    await seed(page, appearance);
    await page.goto('/');
    await capture(page, info, `dashboard-restored-${appearance}`);
    await settings(page, 'Measurements');
    await expect(page.getByText('Trend', { exact: true })).toBeVisible();
    await capture(page, info, `measurements-${appearance}`);
    await page.getByTestId('measurement-history-entry').getByRole('button', { name: /^Edit / }).click();
    const field = page.getByLabel('Body weight value', { exact: true });
    await field.fill('81');
    await capture(page, info, `measurement-ready-${appearance}`);
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      (window as any).restoreWrites = () => { Storage.prototype.setItem = original; };
      Storage.prototype.setItem = function (key, value) {
        if (key === '@forge/settings-preferences') throw new DOMException('Storage full', 'QuotaExceededError');
        original.call(this, key, value);
      };
    });
    const save = page.getByRole('button', { name: 'Save measurement', exact: true });
    await save.click();
    const error = page.getByRole('alert');
    await expect(error).toContainText('Measurement not saved');
    await expect(error).toContainText('Your edit is still here. Try saving again.');
    await expect(field).toHaveValue('81');
    const date = await page.getByText(/Today ·/).textContent();
    const errorBox = await error.boundingBox();
    const saveBox = await save.boundingBox();
    expect(errorBox!.y + errorBox!.height).toBeLessThanOrEqual(saveBox!.y);
    expect(errorBox!.x).toBeGreaterThanOrEqual(0);
    expect(errorBox!.x + errorBox!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('@forge/settings-preferences')!).dailyMeasurementEntries[0].value)).toBe(80);
    await capture(page, info, `measurement-failure-${appearance}`);
    await save.click();
    await expect(error).toBeVisible();
    await expect(field).toHaveValue('81');
    await expect(page.getByText(/Today ·/)).toHaveText(date!);
    await page.evaluate(() => (window as any).restoreWrites());
    await save.click();
    await expect(field).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('@forge/settings-preferences')!).dailyMeasurementEntries[0].value)).toBe(81);
    await capture(page, info, `measurement-saved-${appearance}`);
  });

  test(`${appearance} duration title remains complete`, async ({ page }, info) => {
    await seed(page, appearance);
    await page.goto('/');
    await settings(page, 'General');
    await capture(page, info, `general-restored-${appearance}`);
    await page.getByRole('button', { name: 'Default rest time', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Close default rest time picker', exact: true })).toBeVisible();
    await capture(page, info, `duration-title-${appearance}`);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Close default rest time picker', exact: true })).toHaveCount(0);
  });

  test(`${appearance} History uses singular exercise and set labels`, async ({ page }, info) => {
    await seed(page, appearance);
    await page.addInitScript(() => localStorage.setItem('@forge/completed-workouts', JSON.stringify([{
      id: 'singular', name: 'Audit session', type: 'Strength', startedAt: Date.now() - 600000, completedAt: Date.now(), durationSeconds: 600,
      exercises: [{ id: 'ex', exerciseId: 'barbell-bench-press', name: 'Barbell Bench Press', sets: [{ id: 'set', weight: '50', reps: '8', completed: true }] }],
    }])));
    await page.goto('/');
    await page.getByRole('tab', { name: 'History', exact: true }).click();
    await expect(page.getByText('1 exercise, 1 set', { exact: true })).toBeVisible();
    await capture(page, info, `history-singular-${appearance}`);
  });
}
