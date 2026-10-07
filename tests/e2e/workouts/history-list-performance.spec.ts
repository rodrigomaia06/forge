import { expect, test, type Locator } from '@playwright/test';

async function scrollToFraction(list: Locator, fraction: number) {
  await list.evaluate((element, value) => {
    element.scrollTop = (element.scrollHeight - element.clientHeight) * value;
  }, fraction);
}

for (const appearance of ['light', 'dark'] as const) {
  test(`bounds workout mounting within a single dense week (${appearance})`, async ({
    page,
  }, testInfo) => {
    await page.addInitScript((theme) => {
      const completedAt = Date.now();
      localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance: theme }));
      localStorage.setItem(
        '@forge/completed-workouts',
        JSON.stringify(
          Array.from({ length: 500 }, (_, i) => ({
            id: `dense-${i}`,
            name: `Session ${i}`,
            type: 'Strength',
            startedAt: completedAt - i * 1000 - 60000,
            completedAt: completedAt - i * 1000,
            durationSeconds: 60,
            exercises: [],
          })),
        ),
      );
      const workouts = JSON.parse(localStorage.getItem('@forge/completed-workouts') ?? '[]');
      for (const days of [7, 14]) {
        const at = completedAt - days * 86400000;
        workouts.push({
          id: `previous-${days}`,
          name: `Previous session ${days}`,
          type: 'Strength',
          startedAt: at - 60000,
          completedAt: at,
          durationSeconds: 60,
          exercises: [],
        });
      }
      localStorage.setItem('@forge/completed-workouts', JSON.stringify(workouts));
    }, appearance);
    await page.goto('/');
    await page.getByRole('tab', { name: 'History' }).click();
    await expect(page.getByRole('button', { name: 'Open Session 0', exact: true })).toBeVisible();
    const rows = page.getByTestId(/^history-timeline-dense-/);
    await expect.poll(() => rows.count()).toBeLessThan(100);
    await page.waitForTimeout(250);
    await page.screenshot({ path: testInfo.outputPath(`history-week-${appearance}.png`) });
    const list = page.getByTestId('history-list');
    const oldest = page.getByRole('button', { name: 'Open Session 499', exact: true });
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
    await page.waitForTimeout(250);
    await page.screenshot({ path: testInfo.outputPath(`history-periods-${appearance}.png`) });
    await page.getByRole('button', { name: 'Open Session 499', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Back to History' })).toBeVisible();
  });
}
