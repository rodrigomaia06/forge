const { test, expect } = require('@playwright/test');

test.describe('Dashboard dock geometry', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('dashboard-shell')).toBeVisible();
  });

  test('keeps the dock inside the shell without covering visible context', async ({ page }) => {
    const shell = await page.getByTestId('dashboard-shell').boundingBox();
    const dock = await page.getByTestId('dashboard-dock-cylinder').boundingBox();
    const contextLocator = page.getByTestId('dashboard-context-card');
    const context = (await contextLocator.count()) > 0 ? await contextLocator.boundingBox() : null;

    console.log('[dock geometry]', JSON.stringify({ shell, dock, context }));

    expect(shell).not.toBeNull();
    expect(dock).not.toBeNull();
    expect(context).not.toBeNull();

    expect(dock.x).toBeGreaterThanOrEqual(shell.x);
    expect(dock.x + dock.width).toBeLessThanOrEqual(shell.x + shell.width);
    expect(dock.y).toBeGreaterThanOrEqual(shell.y);
    expect(dock.y + dock.height).toBeLessThanOrEqual(shell.y + shell.height);

    expect(await page.getByTestId('dashboard-dock-slot')).toHaveCSS('position', 'absolute');
    await expect(page.getByTestId('dashboard-dock-blur')).toBeVisible();
  });

  test('captures the dock as a single bounded surface', async ({ page }) => {
    const dockSlot = page.getByTestId('dashboard-dock-slot');
    await expect(dockSlot).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(page.getByTestId('dashboard-dock-cylinder')).toHaveScreenshot('dashboard-dock.png');
  });
});
