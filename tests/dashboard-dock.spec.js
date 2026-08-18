const { test, expect } = require('@playwright/test');

function intersection(first, second) {
  const left = Math.max(first.x, second.x);
  const top = Math.max(first.y, second.y);
  const right = Math.min(first.x + first.width, second.x + second.width);
  const bottom = Math.min(first.y + first.height, second.y + second.height);
  return { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

test.describe('Dashboard dock geometry', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('dashboard-shell')).toBeVisible();
  });

  test('keeps the dock inside the shell without covering visible context', async ({ page }) => {
    const shell = await page.getByTestId('dashboard-shell').boundingBox();
    const scroll = await page.getByTestId('dashboard-scroll').boundingBox();
    const dock = await page.getByTestId('dashboard-dock-cylinder').boundingBox();
    const contextLocator = page.getByTestId('dashboard-context-card');
    const context = (await contextLocator.count()) > 0 ? await contextLocator.boundingBox() : null;

    console.log('[dock geometry]', JSON.stringify({ shell, scroll, dock, context }));

    expect(shell).not.toBeNull();
    expect(scroll).not.toBeNull();
    expect(dock).not.toBeNull();
    expect(context).not.toBeNull();

    expect(dock.x).toBeGreaterThanOrEqual(shell.x);
    expect(dock.x + dock.width).toBeLessThanOrEqual(shell.x + shell.width);
    expect(dock.y).toBeGreaterThanOrEqual(shell.y);
    expect(dock.y + dock.height).toBeLessThanOrEqual(shell.y + shell.height);

    const visibleContext = intersection(context, scroll);
    const overlap = intersection(visibleContext, dock);
    expect(overlap.width * overlap.height).toBe(0);
  });

  test('captures the dock as a single bounded surface', async ({ page }) => {
    const dockSlot = page.getByTestId('dashboard-dock-slot');
    await expect(dockSlot).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(page.getByTestId('dashboard-dock-cylinder')).toHaveScreenshot('dashboard-dock.png');
  });
});
