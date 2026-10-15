import { expect, test, type Page, type TestInfo } from '@playwright/test';

async function inspectControls(page: Page, info: TestInfo, state: string, labels: string[]) {
  let top = Infinity;
  let bottom = 0;
  for (const name of labels) {
    const button = page.getByRole('button', { name, exact: true }).last();
    await expect(button).toBeVisible();
    await expect
      .poll(() =>
        button.evaluate((element) => {
          for (let node: Element | null = element; node; node = node.parentElement) {
            const style = getComputedStyle(node);
            if (Number(style.opacity) < 0.99) return false;
            if (style.transform !== 'none' && Math.abs(new DOMMatrix(style.transform).m42) > 0.5)
              return false;
          }
          return true;
        }),
      )
      .toBe(true);
    const separation = await button.evaluate((element) => {
      let fill: number[] | undefined;
      for (let node: Element | null = element; node; node = node.parentElement) {
        const color = getComputedStyle(node).backgroundColor;
        const channels = color.match(/[\d.]+/g)?.map(Number);
        if (!channels || (channels.length === 4 && channels[3] < 1)) continue;
        if (fill)
          return Math.max(...fill.slice(0, 3).map((value, i) => Math.abs(value - channels[i])));
        fill = channels;
      }
      return 0;
    });
    // Catch near-identical painted tones as well as entirely missing fills.
    expect(separation, `${state}: ${name} surface separation`).toBeGreaterThanOrEqual(12);
    const box = (await button.boundingBox())!;
    top = Math.min(top, box.y);
    bottom = Math.max(bottom, box.y + box.height);
  }
  const viewport = page.viewportSize()!;
  const y = Math.max(0, top - 20);
  await page.screenshot({
    path: info.outputPath(`${state}.png`),
    clip: {
      x: 0,
      y,
      width: viewport.width,
      height: Math.min(viewport.height - y, bottom - y + 20),
    },
  });
}

for (const appearance of ['light', 'dark']) {
  test(`painted header and sheet actions stay visible (${appearance})`, async ({ page }, info) => {
    await page.addInitScript((appearance) => {
      localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance }));
    }, appearance);
    await page.goto('/');
    await inspectControls(page, info, 'dashboard', ['Edit dashboard', 'Start workout']);
    await page.getByRole('button', { name: 'Edit dashboard', exact: true }).click();
    await inspectControls(page, info, 'dashboard-editing', ['Done editing dashboard']);
    await page.getByRole('button', { name: 'Done editing dashboard', exact: true }).click();
    await page.getByRole('tab', { name: 'History', exact: true }).click();
    await inspectControls(page, info, 'history', ['Add past workout', 'Filter']);
    await page.getByRole('tab', { name: 'Plans', exact: true }).click();
    await inspectControls(page, info, 'plans', ['Create workout, routine, or plan']);
    await page.getByRole('tab', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'General', exact: true }).click();
    await inspectControls(page, info, 'settings', ['Back to Settings']);
    await page.getByRole('button', { name: 'Default rest time', exact: true }).click();
    await inspectControls(page, info, 'rest-picker', ['Close default rest time picker']);
    await page.getByRole('button', { name: 'Close default rest time picker', exact: true }).click();
    await page.getByRole('button', { name: 'Back to Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Exercises', exact: true }).click();
    await page.getByRole('button', { name: 'All exercises, 608 exercises', exact: true }).click();
    await inspectControls(page, info, 'exercise-browser', [
      'Back to Exercises',
      'Filters',
      'Create custom exercise',
    ]);
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    await inspectControls(page, info, 'exercise-filters', ['Cancel exercise filters']);
    await page.getByRole('button', { name: 'Edit Equipment filter, Any', exact: true }).click();
    await inspectControls(page, info, 'filter-selection', [
      'Back to filters',
      'Cancel exercise filters',
    ]);
    await page.getByRole('button', { name: 'Cancel exercise filters', exact: true }).click();
    await page.getByRole('button', { name: 'Back to Exercises', exact: true }).click();
    await page.getByRole('button', { name: 'Back to Settings', exact: true }).click();
    await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
    await page.getByRole('button', { name: 'Start workout', exact: true }).click();
    await page
      .getByTestId('dashboard-workout-source-chooser')
      .getByRole('button', { name: 'Blank workout', exact: true })
      .click();
    await inspectControls(page, info, 'live-workout', ['Cancel workout', 'Finish workout']);
    await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
    await inspectControls(page, info, 'add-exercises', ['Close add exercises']);
  });
}
