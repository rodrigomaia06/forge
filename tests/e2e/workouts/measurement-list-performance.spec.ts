import { expect, test, type Locator } from '@playwright/test';

async function scrollToFraction(list: Locator, fraction: number) {
  await list.evaluate((element, value) => {
    element.scrollTop = (element.scrollHeight - element.clientHeight) * value;
  }, fraction);
}

for (const appearance of ['light', 'dark'] as const) {
  test(`virtualizes expanded measurements and keeps record editing (${appearance})`, async ({
    page,
  }, testInfo) => {
    await page.addInitScript((theme) => {
      localStorage.setItem(
        '@forge/settings-preferences',
        JSON.stringify({
          appearance: theme,
          dailyMeasurementDefinitions: [
            { id: 'weight', name: 'Body weight', unit: 'kg', icon: 'weight', color: '#4D7B67' },
          ],
          dailyMeasurementEntries: Array.from({ length: 500 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            return { id: `record-${i}`, definitionId: 'weight', date: key, value: 80 + i / 10 };
          }),
        }),
      );
    }, appearance);
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Measurements' }).click();
    await expect(page.getByTestId('measurement-history-record-0')).toBeAttached();
    await page.waitForTimeout(250);
    await page.screenshot({ path: testInfo.outputPath(`measurements-preview-${appearance}.png`) });
    await page.getByRole('button', { name: 'Show all 500 records' }).click();
    const rows = page.getByTestId(/^measurement-history-record-/);
    await expect.poll(() => rows.count()).toBeLessThan(100);
    const list = page.getByTestId('measurement-history-list');
    await list.evaluate((element) => {
      element.scrollTop = 1300;
    });
    await page.waitForTimeout(250);
    await page.screenshot({ path: testInfo.outputPath(`measurements-expanded-${appearance}.png`) });
    const oldest = page.getByTestId('measurement-history-record-499');
    await expect
      .poll(
        async () => {
          await scrollToFraction(list, 1);
          return oldest.isVisible();
        },
        { timeout: 15000, intervals: [100] },
      )
      .toBe(true);
    await expect.poll(() => rows.count()).toBeLessThan(100);
    await oldest.getByRole('button', { name: /^Edit / }).click();
    await expect(page.getByLabel('Body weight value')).toHaveValue('129.9');
    await page.getByLabel('Body weight value').fill('130');
    await page.getByRole('button', { name: 'Save measurement' }).click();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(
              localStorage.getItem('@forge/settings-preferences') ?? '{}',
            ).dailyMeasurementEntries.find((entry: { id: string }) => entry.id === 'record-499')
              .value,
        ),
      )
      .toBe(130);
    await expect(
      page.getByRole('button', { name: 'Close record measurement', exact: true }),
    ).toHaveCount(0);
    await page.getByRole('button', { name: 'Edit measurements' }).click();
    const rowBox = await oldest.boundingBox();
    if (!rowBox) throw new Error('Missing oldest measurement row');
    await page.mouse.move(rowBox.x + rowBox.width * 0.8, rowBox.y + rowBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(rowBox.x + rowBox.width * 0.25, rowBox.y + rowBox.height / 2, {
      steps: 12,
    });
    await page.mouse.up();
    await oldest.getByRole('button', { name: /^Delete .* record$/ }).click();
    await expect(oldest).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem('@forge/settings-preferences') ?? '{}')
              .dailyMeasurementEntries.length,
        ),
      )
      .toBe(499);
  });
}
