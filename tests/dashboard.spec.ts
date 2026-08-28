import { expect, test } from '@playwright/test';

test.describe('Dashboard', () => {
  test('matches the iPhone visual baseline', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('dashboard-header-title')).toBeVisible();
    await expect(page).toHaveScreenshot('dashboard.png', { fullPage: true });
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
