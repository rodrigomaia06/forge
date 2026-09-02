import { expect, test } from '@playwright/test';

test.describe('Dashboard', () => {
  test('matches the iPhone visual baseline', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-air', 'The baseline is intentionally iPhone-specific.');
    await page.goto('/');

    await expect(page.getByTestId('dashboard-header-title')).toBeVisible();
    await expect(page).toHaveScreenshot('dashboard.png', {
      fullPage: true,
      mask: [page.getByTestId('dashboard-header-title')],
    });
  });

  test('switches calendar scale from the overflow menu and selects a workout day', async ({
    page,
  }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Change calendar view' }).click();
    await expect(page.getByRole('menuitem', { name: 'Week' })).toBeVisible();
    await page.mouse.click(40, 500);
    await expect(page.getByRole('menuitem', { name: 'Week' })).toBeHidden();
    await page.getByRole('button', { name: 'Change calendar view' }).click();
    await page.getByRole('menuitem', { name: 'Week' }).click();
    await expect(page.getByText('Week of August 24')).toBeVisible();

    await page.getByRole('button', { name: /24 August 2026/ }).click();
    await expect(page.getByTestId('calendar-selected-day')).toBeVisible();
  });

  test('gives the dock priority while the calendar view menu is open', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Change calendar view' }).click();
    await expect(page.getByRole('menuitem', { name: 'Week' })).toBeVisible();

    await page.getByRole('tab', { name: 'History' }).click();

    await expect(page.getByText('History', { exact: true })).toBeVisible();
  });

  test('uses one title baseline and typography across primary tabs', async ({ page }) => {
    await page.goto('/');
    const readTitle = async (locator: ReturnType<typeof page.locator>) =>
      locator.evaluate((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return {
          x: rect.x,
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          lineHeight: style.lineHeight,
          letterSpacing: style.letterSpacing,
          textShadow: style.textShadow,
        };
      });

    const dashboardTitle = await readTitle(page.getByTestId('dashboard-header-title'));
    await page.getByRole('tab', { name: 'History' }).click();
    const historyTitle = await readTitle(page.getByTestId('history-title'));
    await page.getByRole('tab', { name: 'Plans' }).click();
    const plansTitle = await readTitle(page.getByText('Plans', { exact: true }));
    await page.getByRole('tab', { name: 'Settings' }).click();
    const settingsTitle = await readTitle(page.getByTestId('settings-title'));

    for (const title of [historyTitle, plansTitle, settingsTitle]) {
      expect(Math.abs(title.x - dashboardTitle.x)).toBeLessThanOrEqual(1);
      expect(title.fontFamily).toBe(dashboardTitle.fontFamily);
      expect(title.fontSize).toBe(dashboardTitle.fontSize);
      expect(title.fontWeight).toBe(dashboardTitle.fontWeight);
      expect(title.lineHeight).toBe(dashboardTitle.lineHeight);
      expect(title.letterSpacing).toBe(dashboardTitle.letterSpacing);
      expect(title.textShadow).toBe(dashboardTitle.textShadow);
    }
  });

  test('keeps one persistent dock and moves its selected indicator between tabs', async ({ page }) => {
    await page.goto('/');

    const dock = page.getByTestId('dashboard-dock-cylinder');
    const indicator = page.getByTestId('dashboard-nav-selection-pill');
    await expect(dock).toHaveCount(1);
    await expect(page.getByRole('tab', { name: 'Dashboard' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    const dashboardIndicator = await indicator.boundingBox();
    const dashboardIcon = await page
      .getByRole('tab', { name: 'Dashboard' })
      .locator('svg')
      .boundingBox();
    const inactiveHistoryIcon = await page
      .getByRole('tab', { name: 'History' })
      .locator('svg')
      .boundingBox();
    expect(dashboardIcon?.width).toBeGreaterThan(inactiveHistoryIcon?.width ?? 0);
    await page.getByRole('tab', { name: 'History' }).click();
    await expect(page.getByTestId('history-title')).toBeVisible();
    await expect(dock).toHaveCount(1);
    await expect(page.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true');
    await expect(indicator).toBeVisible();
    await page.waitForTimeout(180);
    const historyIndicator = await indicator.boundingBox();
    const historyIcon = await page
      .getByRole('tab', { name: 'History' })
      .locator('svg')
      .boundingBox();
    const inactiveDashboardIcon = await page
      .getByRole('tab', { name: 'Dashboard' })
      .locator('svg')
      .boundingBox();
    expect(historyIcon?.width).toBeGreaterThan(inactiveDashboardIcon?.width ?? 0);

    await page.getByRole('tab', { name: 'History' }).click();
    await expect(page.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true');
    const retainedHistoryIndicator = await indicator.boundingBox();

    expect(dashboardIndicator).not.toBeNull();
    expect(historyIndicator).not.toBeNull();
    expect(retainedHistoryIndicator).not.toBeNull();
    expect(historyIndicator?.x).toBeGreaterThan(dashboardIndicator?.x ?? 0);
    expect(retainedHistoryIndicator?.x).toBeCloseTo(historyIndicator?.x ?? 0, 0);
  });

  test('uses the Forge semantic scale for page and supporting text', async ({ page }) => {
    await page.goto('/');

    const readTextMetrics = async (locator: ReturnType<typeof page.locator>) =>
      locator.evaluate((element) => {
        const style = window.getComputedStyle(element);
        return { fontSize: style.fontSize, lineHeight: style.lineHeight };
      });

    await expect(page.getByTestId('dashboard-header-title')).toBeVisible();
    const selectedDate = page.getByText(/^August \d{1,2}, 2026$/);
    await expect(selectedDate).toBeVisible();
    expect(await readTextMetrics(page.getByTestId('dashboard-header-title'))).toEqual({
      fontSize: '31px',
      lineHeight: '36px',
    });
    expect(await readTextMetrics(selectedDate)).toEqual({
      fontSize: '18px',
      lineHeight: '24px',
    });
    await page.getByRole('tab', { name: 'History' }).click();
    expect(await readTextMetrics(page.getByTestId('history-title'))).toEqual({
      fontSize: '31px',
      lineHeight: '36px',
    });
  });
});
