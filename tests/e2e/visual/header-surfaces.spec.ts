import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

async function expectCentered(page: Page, title: Locator) {
  const box = (await title.boundingBox())!;
  expect(Math.abs(box.x + box.width / 2 - page.viewportSize()!.width / 2)).toBeLessThan(1);
  await expect(title).toHaveCSS('text-align', 'center');
}

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
    // The Light surface (#F1F1F1) differs from its white page by 14.
    expect(separation, `${state}: ${name} surface separation`).toBeGreaterThanOrEqual(14);
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
    await expect(page.getByTestId('dashboard-header-title')).toHaveCSS('text-align', 'start');
    await inspectControls(page, info, 'dashboard', ['Edit dashboard', 'Start workout']);
    await page.getByRole('button', { name: 'Edit dashboard', exact: true }).click();
    await inspectControls(page, info, 'dashboard-editing', ['Done editing dashboard']);
    await page.getByRole('button', { name: 'Done editing dashboard', exact: true }).click();
    await page.getByRole('tab', { name: 'History', exact: true }).click();
    await expect(page.getByTestId('history-title')).toHaveCSS('text-align', 'start');
    await inspectControls(page, info, 'history', ['Add past workout', 'Filter']);
    await page.getByRole('tab', { name: 'Plans', exact: true }).click();
    await expect(page.getByText('Plans', { exact: true }).first()).toHaveCSS('text-align', 'start');
    await inspectControls(page, info, 'plans', ['Create workout, routine, or plan']);
    await page.getByRole('tab', { name: 'Settings', exact: true }).click();
    await expect(page.getByTestId('settings-title')).toHaveCSS('text-align', 'start');
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
    await expectCentered(page, page.getByTestId('live-workout-header-title'));
    await inspectControls(page, info, 'live-workout', ['Cancel workout', 'Finish workout']);
    await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
    await inspectControls(page, info, 'add-exercises', ['Close add exercises']);
  });
}
