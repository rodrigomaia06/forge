import { expect, test } from '@playwright/test';

test.describe('Dashboard dock geometry', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('dashboard-shell')).toBeVisible();
  });

  test('keeps the persistent dock floating above the tab scene edge', async ({ page }) => {
    const viewport = page.viewportSize();
    const dock = await page.getByTestId('dashboard-dock-cylinder').boundingBox();
    const contextLocator = page.getByTestId('dashboard-context-card');
    const context = (await contextLocator.count()) > 0 ? await contextLocator.boundingBox() : null;

    expect(dock).not.toBeNull();
    expect(context).not.toBeNull();
    expect(viewport).not.toBeNull();
    if (!dock || !context || !viewport)
      throw new Error('Expected dashboard geometry to be measurable');

    expect(dock.x).toBeGreaterThanOrEqual(0);
    expect(dock.x + dock.width).toBeLessThanOrEqual(viewport.width);
    expect(dock.y).toBeGreaterThanOrEqual(0);
    expect(dock.y + dock.height).toBeLessThanOrEqual(viewport.height);
    expect(dock.width).toBeLessThanOrEqual(360);
    expect(dock.width).toBeGreaterThanOrEqual(304);
    expect(dock.height).toBeGreaterThanOrEqual(60);
    expect(dock.height).toBeLessThanOrEqual(72);

    expect(await page.getByTestId('dashboard-dock-slot')).toHaveCSS('position', 'absolute');
    const header = await page.getByTestId('dashboard-header').boundingBox();
    const scroll = await page.getByTestId('dashboard-scroll').boundingBox();
    expect(header).not.toBeNull();
    expect(scroll).not.toBeNull();
    if (!header || !scroll)
      throw new Error('Expected dashboard header and scroll geometry to be measurable');
    expect(header.y).toBe(scroll.y);
    expect(dock.y).toBeGreaterThanOrEqual(header.y + header.height);
    expect(dock.y + dock.height).toBeLessThanOrEqual(viewport.height - 12);
    await expect(page.getByTestId('dashboard-header')).toHaveCSS('position', 'relative');
    await expect(page.getByTestId('dashboard-dock-vignette')).toBeVisible();
    await expect(page.getByTestId('dashboard-dock-home-indicator')).toBeVisible();
    await expect(page.getByTestId('dashboard-header-title')).toBeVisible();
    await expect(page.locator('[data-testid^="dashboard-nav-label-"]')).toHaveCount(0);
    await expect(page.getByTestId('dashboard-nav-history')).toBeVisible();
    await expect(page.getByTestId('dashboard-nav-plans')).toBeVisible();
    await expect(page.getByTestId('dashboard-nav-settings')).toBeVisible();
    await expect(page.getByTestId('dashboard-nav-workout')).toHaveCount(0);
  });

  test('captures the dock as a single bounded surface', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.use.isMobile !== true,
      'Desktop remains functional coverage only; phone profiles own visual acceptance.',
    );

    const dockSlot = page.getByTestId('dashboard-dock-slot');
    await expect(dockSlot).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(page.getByTestId('dashboard-dock-cylinder')).toHaveScreenshot(
      'dashboard-dock.png',
    );
  });
});
