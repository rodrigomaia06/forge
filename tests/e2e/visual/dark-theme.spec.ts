import { expect, test, type Page } from '@playwright/test';

const output = 'tests/results/captures/dark';

async function enableDark(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance: 'dark' }));
  });
}

async function capture(page: Page, name: string) {
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
}

async function rect(page: Page, testId: string) {
  return page
    .getByTestId(testId)
    .last()
    .evaluate((element) => {
      const box = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        font: style.fontFamily,
        size: style.fontSize,
      };
    });
}

test('captures primary Forge surfaces in Dark appearance', async ({ page }) => {
  await enableDark(page);
  await page.goto('/');
  await expect(page.getByTestId('dashboard-header-title').last()).toBeVisible();
  await capture(page, 'dashboard');

  await page.getByRole('tab', { name: 'History' }).click();
  await capture(page, 'history');

  await page.getByRole('tab', { name: 'Plans' }).click();
  await capture(page, 'plans');

  await page.getByRole('tab', { name: 'Settings' }).click();
  await capture(page, 'settings');
  await page.getByRole('button', { name: 'Exercises' }).click();
  await capture(page, 'exercise-library');
  await page.getByRole('button', { name: 'All exercises, 21 exercises' }).click();
  await capture(page, 'exercise-browser');
  await page.getByRole('button', { name: 'Filters' }).click();
  await capture(page, 'exercise-filter-sheet');
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Bench Press & 4 variations' }).click();
  await page.getByRole('button', { name: 'Standard' }).click();
  await capture(page, 'exercise-detail');
  await page.getByRole('button', { name: 'Change rest time, currently Default' }).click();
  await capture(page, 'exercise-rest-picker');
  await page.getByRole('button', { name: 'Use default rest time' }).click();
  await page.getByLabel('Close exercise details').click();
  await page.getByRole('button', { name: 'Back to Exercises' }).click();
  await page.getByRole('button', { name: 'Back to Settings' }).click();
  await page.getByRole('button', { name: 'General' }).click();
  await capture(page, 'general');
  await page.getByRole('button', { name: 'Appearance' }).click();
  await capture(page, 'general-appearance-picker');
  if ((page.viewportSize()?.width ?? 0) >= 768) {
    await page.getByRole('radio', { name: 'Dark' }).click();
  } else {
    await page.getByRole('radio', { name: 'Dark' }).click();
  }
  await page.getByRole('button', { name: 'Default rest time' }).click();
  await capture(page, 'general-default-rest-picker');
  await page.getByRole('radio', { name: '00:30' }).dispatchEvent('click');
  await page.getByRole('switch', { name: 'Unfinished workout reminder' }).click();
  await page.getByRole('button', { name: 'Remind after' }).click();
  await capture(page, 'general-reminder-picker');
  await page.getByRole('radio', { name: '15 minutes' }).dispatchEvent('click');
  await page.getByRole('button', { name: 'Back to Settings' }).click();
  await page.getByRole('button', { name: 'Workout types' }).click();
  await capture(page, 'workout-types');
  await page.getByRole('button', { name: 'Strength workout type' }).click();
  await capture(page, 'workout-type-inline');
  await page.getByRole('button', { name: 'Back to Settings' }).click();
  await page.getByRole('button', { name: 'Backup & Export' }).click();
  await capture(page, 'backup');
  await page.getByRole('button', { name: 'Back to Settings' }).click();
  await page.getByRole('button', { name: 'About' }).click();
  await capture(page, 'about');
});

test('keeps layout stable and resolves Light, Dark and System at runtime', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('dashboard-header-title').last()).toBeVisible();
  const lightDashboard = await rect(page, 'dashboard-shell');
  const lightDock = await rect(page, 'dashboard-dock-cylinder');

  await page.getByRole('tab', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'General' }).click();
  await page.getByRole('button', { name: 'Appearance' }).click();
  await page.getByRole('radio', { name: 'Dark' }).click();
  await expect(page.getByRole('button', { name: 'Appearance', exact: true })).toContainText('Dark');
  await page.getByRole('button', { name: 'Back to Settings' }).click();
  await page.getByRole('tab', { name: 'Dashboard' }).click();
  await expect(page.getByTestId('dashboard-header-title').last()).toBeVisible();
  expect(await rect(page, 'dashboard-shell')).toEqual(lightDashboard);
  expect(await rect(page, 'dashboard-dock-cylinder')).toEqual(lightDock);

  const darkBackgrounds = await page.locator('*').evaluateAll(
    (elements) =>
      elements.filter((element) => {
        const color = window.getComputedStyle(element).backgroundColor;
        return color === 'rgb(255, 255, 255)' || color === 'rgb(248, 248, 246)';
      }).length,
  );
  expect(darkBackgrounds).toBe(0);

  await page.reload();
  await page.getByRole('tab', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'General' }).click();
  await page.getByRole('button', { name: 'Appearance' }).click();
  await expect(page.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('radio', { name: 'System' }).click();
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.getByRole('button', { name: 'Appearance', exact: true })).toContainText('System');
  await page.reload();
  await page.getByRole('tab', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'General' }).click();
  await page.getByRole('button', { name: 'Appearance' }).click();
  await expect(page.getByRole('radio', { name: 'System' })).toHaveAttribute('aria-checked', 'true');
});
