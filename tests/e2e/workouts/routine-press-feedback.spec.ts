import { expect, test } from '@playwright/test';

for (const appearance of ['light', 'dark'] as const) {
  test(`${appearance} routine name clearly highlights its action surface`, async ({
    page,
  }, info) => {
    await page.addInitScript((appearance) => {
      localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance }));
      localStorage.setItem(
        '@forge/plans-v1',
        JSON.stringify({
          plans: [],
          standaloneRoutines: [
            {
              id: 'routine',
              name: 'Pull day',
              type: 'Strength',
              createdAt: 1,
              updatedAt: 1,
              exercises: [],
            },
          ],
        }),
      );
    }, appearance);
    await page.goto('/');
    await page.getByRole('tab', { name: 'Plans', exact: true }).click();
    const row = page.getByRole('button', { name: 'Routine actions for Pull day', exact: true });
    await expect(row).toBeVisible();
    const bounds = await row.boundingBox();
    if (!bounds) throw new Error('Routine action must have a visible touch area');
    const before = await row.evaluate((node) => getComputedStyle(node).backgroundColor);
    await page.screenshot({ path: info.outputPath('routine-name-rest.png') });
    await page.mouse.move(bounds.x + 30, bounds.y + bounds.height / 2);
    await page.mouse.down();
    const surface = page.getByTestId('routine-row-routine');
    const layer = surface.getByTestId('forge-press-state-layer');
    await expect(layer).toBeVisible();
    const layerBounds = await layer.boundingBox();
    const surfaceBounds = await surface.boundingBox();
    const startBounds = await page
      .getByRole('button', { name: 'Start Pull day', exact: true })
      .boundingBox();
    expect(Math.abs(layerBounds!.width - surfaceBounds!.width)).toBeLessThan(2);
    expect(Math.abs(layerBounds!.height - surfaceBounds!.height)).toBeLessThan(2);
    expect(layerBounds!.x).toBeLessThan(startBounds!.x);
    expect(layerBounds!.x + layerBounds!.width).toBeGreaterThan(
      startBounds!.x + startBounds!.width,
    );
    await expect(surface.getByTestId('forge-press-state-layer')).toHaveCount(1);
    await expect(row).toHaveCSS('opacity', '1');
    expect(bounds.height).toBeGreaterThanOrEqual(62);
    await page.screenshot({ path: info.outputPath('routine-name-pressed.png') });
    // Releasing outside cancels the action and removes the highlight.
    await page.mouse.move(1, 1);
    await page.mouse.up();
    await expect(layer).toHaveCount(0);
    await expect(row).toHaveCSS('background-color', before);
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
    await row.click();
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close Pull day', exact: true }).click();
    await page.getByRole('button', { name: 'Start Pull day', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Finish workout', exact: true })).toBeVisible();
  });
}
