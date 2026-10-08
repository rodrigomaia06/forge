import { expect, test } from '@playwright/test';

for (const appearance of ['light', 'dark'] as const) {
  test(`${appearance} fresh tabs align empty artwork, titles and actions`, async ({ page }, info) => {
    await page.addInitScript((appearance) => localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance })), appearance);
    await page.goto('/');
    const positions: { artY: number; titleY: number }[] = [];
    const actions: { width: number; height: number; y: number }[] = [];
    for (const tab of ['Dashboard', 'History', 'Plans']) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      const name = tab.toLowerCase();
      const art = page.getByTestId(`${name}-empty-illustration`);
      await expect(art).toBeVisible();
      await expect(page.getByTestId('header-edge')).toHaveCount(0);
      const group = page.getByTestId(`${name}-header-actions`);
      if (tab === 'Plans') await expect(group).toHaveCount(0);
      else await expect(group.getByTestId('header-action-separator')).toHaveCount(1);
      const artBox = await art.boundingBox();
      const titleBox = await page.getByTestId(`${name}-empty-title`).boundingBox();
      expect(artBox!.width).toBe(150);
      expect(artBox!.height).toBe(112);
      expect(artBox!.x + artBox!.width / 2).toBeCloseTo(page.viewportSize()!.width / 2, 0);
      positions.push({ artY: artBox!.y, titleY: titleBox!.y });
      if (tab !== 'Plans') {
        const action = page.getByRole('button', { name: tab === 'Dashboard' ? 'Add widgets' : 'Start a workout', exact: true });
        const bounds = await action.boundingBox();
        actions.push({ width: bounds!.width, height: bounds!.height, y: bounds!.y });
        expect(bounds!.x + bounds!.width / 2).toBeCloseTo(page.viewportSize()!.width / 2, 0);
      }
      await page.waitForTimeout(600);
      await page.screenshot({ path: info.outputPath(`${name}-empty-${appearance}.png`) });
    }
    for (const position of positions) {
      expect(position.artY).toBe(positions[0].artY);
      expect(position.titleY).toBe(positions[0].titleY);
    }
    expect(actions[0]).toEqual(actions[1]);
    expect(actions[0].height).toBeGreaterThanOrEqual(44);
    await page.goto('/');
    await expect(page.getByTestId('dashboard-empty-illustration')).toBeVisible();
    expect((await page.getByTestId('dashboard-empty-illustration').boundingBox())!.y).toBe(positions[0].artY);
    await page.getByRole('button', { name: 'Add widgets', exact: true }).click();
    await expect(page.getByRole('button', { name: 'This week', exact: true })).toBeVisible();
  });

  test(`${appearance} populated Plans root retains the original edit/add separator`, async ({ page }, info) => {
    await page.addInitScript((appearance) => {
      localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance }));
      localStorage.setItem('@forge/plans-v1', JSON.stringify({ plans: [], standaloneRoutines: [{ id: 'routine', name: 'Test routine', type: 'Strength', exercises: [] }] }));
    }, appearance);
    await page.goto('/');
    await page.getByRole('tab', { name: 'Plans', exact: true }).click();
    await expect(page.getByTestId('plans-header-actions')).toBeVisible();
    const divider = page.getByTestId('plans-header-actions').getByTestId('header-action-separator');
    await expect(divider).toHaveCount(1);
    await expect(divider).toHaveCSS('background-color', appearance === 'light' ? 'rgb(85, 88, 92)' : 'rgb(195, 200, 204)');
    await expect(divider).toHaveCSS('height', '28px');
    const bounds = await page.getByTestId('plans-header-actions').boundingBox();
    await page.waitForTimeout(600);
    await page.screenshot({ path: info.outputPath(`plans-actions-${appearance}.png`) });
    await page.getByRole('button', { name: 'Edit plans', exact: true }).click();
    const done = page.getByRole('button', { name: 'Done editing plans', exact: true });
    await expect(done).toBeVisible();
    expect(Math.abs((await done.boundingBox())!.width - bounds!.width)).toBeLessThanOrEqual(1);
    await page.waitForTimeout(600);
    await done.click();
    await expect(page.getByTestId('plans-header-actions')).toHaveCount(1);
    await expect(page.getByTestId('plans-header-actions')).toBeVisible();
  });
}
