const { test, expect } = require('@playwright/test');

function intersection(first, second) {
  const left = Math.max(first.x, second.x);
  const top = Math.max(first.y, second.y);
  const right = Math.min(first.x + first.width, second.x + second.width);
  const bottom = Math.min(first.y + first.height, second.y + second.height);
  return { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

function rectFromBox(box) {
  return { x: box.x, y: box.y, width: box.width, height: box.height };
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
    const context = await page.getByTestId('dashboard-context-card').boundingBox();

    console.log('[dock geometry]', JSON.stringify({ shell, scroll, dock, context }));

    expect(shell).not.toBeNull();
    expect(scroll).not.toBeNull();
    expect(dock).not.toBeNull();
    expect(context).not.toBeNull();

    expect(dock.x).toBeGreaterThanOrEqual(shell.x);
    expect(dock.x + dock.width).toBeLessThanOrEqual(shell.x + shell.width);
    expect(dock.y).toBeGreaterThanOrEqual(shell.y);
    expect(dock.y + dock.height).toBeLessThanOrEqual(shell.y + shell.height);

    const visibleContext = intersection(rectFromBox(context), rectFromBox(scroll));
    const overlap = intersection(visibleContext, rectFromBox(dock));
    expect(overlap.width * overlap.height).toBe(0);
  });

  test('captures the dock as a single bounded surface', async ({ page }) => {
    const dockSlot = page.getByTestId('dashboard-dock-slot');
    await expect(dockSlot).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(page.getByTestId('dashboard-dock-cylinder')).toHaveScreenshot('dashboard-dock.png');
  });
});
