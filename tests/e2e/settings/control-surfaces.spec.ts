import { expect, test, type Locator } from '@playwright/test';

async function expectDistinctFill(control: Locator) {
  await expect(control).toBeVisible();
  expect(await control.evaluate(node => {
    const fill = getComputedStyle(node).backgroundColor;
    if (fill === 'rgba(0, 0, 0, 0)' || fill === 'transparent') return false;
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      const parentFill = getComputedStyle(parent).backgroundColor;
      if (parentFill !== 'rgba(0, 0, 0, 0)' && parentFill !== 'transparent') return fill !== parentFill;
    }
    return false;
  })).toBe(true);
}

async function waitForSheet(control: Locator) {
  await expect.poll(() => control.evaluate(element => {
    for (let node: Element | null = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (Number(style.opacity) < 0.99) return false;
      if (style.transform !== 'none' && Math.abs(new DOMMatrix(style.transform).m42) > 0.5) return false;
    }
    return true;
  })).toBe(true);
}

for (const appearance of ['light', 'dark']) {
  test(`settings choices and transfer controls have clear boundaries (${appearance})`, async ({ page }, info) => {
    await page.addInitScript(appearance => {
      localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance }));
    }, appearance);
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'General', exact: true }).click();
    await page.getByRole('switch', { name: 'Unfinished workout reminder', exact: true }).click();
    await page.getByRole('button', { name: 'Remind after', exact: true }).click();
    const sheet = page.getByTestId('reminder-sheet-surface');
    for (const choice of await sheet.getByRole('radio').all()) await expectDistinctFill(choice);
    await waitForSheet(sheet.getByRole('radio', { name: '1 hour', exact: true }));
    await page.screenshot({ path: info.outputPath(`settings-choices-${appearance}.png`) });
    await sheet.getByRole('radio', { name: '1 hour', exact: true }).click();
    await page.getByRole('button', { name: 'Back to Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Backup & Export', exact: true }).click();
    await page.getByRole('button', { name: 'Export data', exact: true }).click();
    await expectDistinctFill(page.getByRole('button', { name: 'Export selected data', exact: true }));
    await waitForSheet(page.getByRole('button', { name: 'Export selected data', exact: true }));
    await page.screenshot({ path: info.outputPath(`transfer-controls-${appearance}.png`) });
  });
}

for (const appearance of ['light', 'dark']) {
  test(`log choices form a connected list with visible boundaries (${appearance})`, async ({ page }, info) => {
    await page.addInitScript(appearance => { localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance })); localStorage.setItem('@forge/diagnostics-v1', JSON.stringify([{ id: 'test-log', kind: 'app-opened', at: Date.now() }])); }, appearance);
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Logs', exact: true }).click();
    await page.getByRole('button', { name: 'Show', exact: true }).click();
    const all = page.getByRole('radio', { name: 'All events', exact: true });
    const failures = page.getByRole('radio', { name: 'Failures', exact: true });
    await waitForSheet(all);
    await expect(all).toHaveAttribute('aria-checked', 'true');
    const first = await all.boundingBox();
    const second = await failures.boundingBox();
    expect(Math.abs(second!.y - first!.y - first!.height)).toBeLessThanOrEqual(2);
    await expect(failures).toHaveCSS('border-top-left-radius', '0px');
    if (appearance === 'light') await expect(failures).not.toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await page.screenshot({ path: info.outputPath(`connected-log-choices-${appearance}.png`) });
    await failures.click();
    await expect(page.getByRole('button', { name: 'Show', exact: true })).toContainText('Failures');
  });
}
