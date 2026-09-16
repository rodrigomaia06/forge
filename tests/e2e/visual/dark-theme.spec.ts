import { expect, test, type Page } from '@playwright/test';

async function enableDark(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance: 'dark' }));
  });
}

async function capture(page: Page, name: string) {
  await page.waitForTimeout(350);
  await page.screenshot({ path: test.info().outputPath(`dark-${name}.png`), fullPage: true });
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

async function expectThemeBackgrounds(page: Page) {
  const expected = await page.evaluate(() => {
    const swatch = document.createElement('div');
    swatch.style.backgroundColor = 'var(--forge-background)';
    document.body.appendChild(swatch);
    const color = getComputedStyle(swatch).backgroundColor;
    swatch.remove();
    return color;
  });
  await expect(page.locator('body')).toHaveCSS('background-color', expected);
  await expect(page.getByTestId('app-root')).toHaveCSS('background-color', expected);
  await expect(page.getByTestId('app-root').locator(':scope > div').first()).toHaveCSS('background-color', expected);
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
  await page.getByRole('button', { name: 'All exercises, 381 exercises' }).click();
  await capture(page, 'exercise-browser');
  await page.getByRole('button', { name: 'Filters' }).click();
  await capture(page, 'exercise-filter-sheet');
  await page.getByRole('button', { name: 'Show all exercises' }).click();
  await page.getByRole('button', { name: 'Bench Press & 3 variations' }).click();
  await page.getByRole('button', { name: 'Open Flat' }).first().click();
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

test('keeps layout stable and resolves Light, Dark and System at runtime', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByTestId('dashboard-header-title').last()).toBeVisible();
  const lightDashboard = await rect(page, 'dashboard-shell');
  const lightDock = await rect(page, 'dashboard-dock-cylinder');
  await expectThemeBackgrounds(page);

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
  await expectThemeBackgrounds(page);

  if (testInfo.project.use.isMobile === true) {
    await page.getByRole('tab', { name: 'Settings' }).click();
    await expect.poll(() => page.getByTestId('settings-scroll').evaluate((element) => {
      for (let parent: HTMLElement | null = element as HTMLElement; parent; parent = parent.parentElement) {
        if (parseFloat(getComputedStyle(parent).opacity) < 1) return false;
      }
      return true;
    })).toBe(true);
    // Expose the backing surface for a browser visual check. UIKit's actual
    // interactive swipe transition still requires an on-device check.
    const content = page.getByTestId('app-root').locator(':scope > div').first();
    await content.evaluate((element: HTMLElement) => {
      element.style.transform = 'scale(0.96)';
      element.style.borderRadius = '40px';
      element.style.overflow = 'hidden';
    });
    await page.screenshot({ path: test.info().outputPath('dark-navigation-backing-surface.png') });
    await content.evaluate((element: HTMLElement) => {
      element.style.removeProperty('transform');
      element.style.removeProperty('border-radius');
      element.style.removeProperty('overflow');
    });
  }

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
  await expectThemeBackgrounds(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.getByTestId('app-root')).toHaveCSS('background-color', 'rgb(23, 25, 28)');
  await expectThemeBackgrounds(page);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.reload();
  await page.getByRole('tab', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'General' }).click();
  await page.getByRole('button', { name: 'Appearance' }).click();
  await expect(page.getByRole('radio', { name: 'System' })).toHaveAttribute('aria-checked', 'true');
});
