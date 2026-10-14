import { expect, test } from '@playwright/test';

for (const appearance of ['light', 'dark']) {
  test(`calendar widget retains every workout segment (${appearance})`, async ({ page }, testInfo) => {
    await page.addInitScript((appearance) => {
      const now = new Date();
      const at = (day: number) => new Date(now.getFullYear(), now.getMonth(), day, 12).getTime();
      localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance }));
      localStorage.setItem('@forge/dashboard-layout-v1', JSON.stringify([{ id: 'calendar', kind: 'calendar', visible: true }]));
      localStorage.setItem('@forge/completed-workouts', JSON.stringify(['Strength', 'Cardio', 'Strength'].map((type, index) => ({
        id: `calendar-${index}`, name: type, type, startedAt: at(now.getDate()) - 3600000,
        completedAt: at(now.getDate()), durationSeconds: 3600, exercises: [],
      })).concat([{ id: 'single', name: 'Single', type: 'Strength', startedAt: at(now.getDate() === 1 ? 2 : 1), completedAt: at(now.getDate() === 1 ? 2 : 1), durationSeconds: 0, exercises: [] }])));
    }, appearance);
    await page.goto('/');
    const day = await page.evaluate(() => new Date().getDate());
    const segments = page.getByTestId(`dashboard-calendar-day-${day}-segment`);
    await expect(segments).toHaveCount(3);
    const colors = await segments.evaluateAll(nodes => nodes.map(node => getComputedStyle(node).backgroundColor));
    expect(colors[0]).toBe(colors[2]);
    expect(colors[0]).not.toBe(colors[1]);
    await expect(page.getByTestId(`dashboard-calendar-day-${day === 1 ? 2 : 1}-segment`)).toHaveCount(1);
    await expect(page.getByTestId('dashboard-calendar-day-28-segment')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`calendar-segments-${appearance}.png`) });
    await page.getByRole('button', { name: 'Open calendar', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Calendar view: Month. Toggle', exact: true })).toBeVisible();
  });
}

