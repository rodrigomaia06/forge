import { expect, test } from '@playwright/test';

for (const appearance of ['light', 'dark']) {
  test(`dashboard and measurements share Gifted Charts (${appearance})`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript((appearance) => {
      const day = (offset: number) => new Date(Date.now() - offset * 86400000);
      localStorage.setItem(
        '@forge/settings-preferences',
        JSON.stringify({
          appearance,
          dailyMeasurementDefinitions: [
            { id: 'weight', name: 'Body weight', unit: 'kg', icon: 'weight', color: '#4D7B67' },
          ],
          dailyMeasurementEntries: Array.from({ length: 10 }, (_, i) => ({
            id: `measurement-${i}`,
            definitionId: 'weight',
            date: day(i).toISOString().slice(0, 10),
            value: 80 + (i % 3) / 2,
          })),
        }),
      );
      localStorage.setItem(
        '@forge/dashboard-layout-v1',
        JSON.stringify([{ id: 'volume', kind: 'volume', visible: true }]),
      );
      localStorage.setItem(
        '@forge/completed-workouts',
        JSON.stringify(
          Array.from({ length: 30 }, (_, i) => ({
            id: `workout-${i}`,
            name: 'Strength',
            type: 'Strength',
            startedAt: day(i).getTime() - 3600000,
            completedAt: day(i).getTime(),
            durationSeconds: 3600,
            exercises: [
              {
                id: `exercise-${i}`,
                name: 'Bench',
                sets: [{ id: `set-${i}`, weight: String(50 + i), reps: '5', completed: true }],
              },
            ],
          })),
        ),
      );
    }, appearance);
    await page.goto('/');
    const dashboardPlot = page.getByTestId('forge-line-plot').first();
    await expect(dashboardPlot).toBeVisible();
    await expect
      .poll(() => dashboardPlot.locator('path[stroke]:not([stroke="none"])').count())
      .toBeGreaterThan(0);
    await page.screenshot({ path: info.outputPath(`dashboard-graph-${appearance}.png`) });
    await page.getByRole('tab', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Measurements', exact: true }).click();
    const measurements = page.getByTestId('forge-sparkline').filter({ visible: true });
    await expect(measurements).toBeVisible();
    await expect(measurements.getByTestId('forge-line-plot')).toHaveCount(2);
    await expect
      .poll(() =>
        measurements.evaluate((element) => {
          for (let node: Element | null = element; node; node = node.parentElement) {
            const style = getComputedStyle(node);
            if (Number(style.opacity) < 0.99) return false;
            if (style.transform !== 'none') {
              const matrix = new DOMMatrix(style.transform);
              if (Math.abs(matrix.m41) > 0.5 || Math.abs(matrix.m42) > 0.5) return false;
            }
          }
          return true;
        }),
      )
      .toBe(true);
    await page.screenshot({ path: info.outputPath(`measurements-graph-${appearance}.png`) });
    expect(errors).toEqual([]);
  });
}
