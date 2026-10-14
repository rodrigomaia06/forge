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

for (const appearance of ['light', 'dark']) {
  for (const hasWorkout of [false, true]) {
    test(`dock keeps tabs aligned with its surface (${appearance}, ${hasWorkout ? 5 : 4} tabs)`, async ({ page }, testInfo) => {
      await page.addInitScript(({ appearance, hasWorkout }) => {
        localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance }));
        localStorage.setItem('@forge/active-workout', JSON.stringify(hasWorkout ? {
          id: 'dock-active', name: 'Workout', type: 'Strength', startedAt: Date.now(), completedAt: null, note: '',
          exercises: [{ id: 'bench', exerciseId: 'barbell-bench-press', name: 'Barbell Bench Press', trackingType: 'weight-reps',
            sets: Array.from({ length: 18 }, (_, index) => ({ id: `set-${index}`, weight: '50', reps: '8', completed: false })) }],
        } : null));
      }, { appearance, hasWorkout });
      await page.goto('/');
      const tabs = ['Dashboard', 'History', ...(hasWorkout ? ['Workout'] : []), 'Plans', 'Settings'];
      for (const name of tabs) {
        await page.getByRole('tab', { name, exact: true }).click();
        await expect.poll(async () => {
          const pill = await page.getByTestId('dashboard-nav-selection-pill').boundingBox();
          const tab = await page.getByRole('tab', { name, exact: true }).boundingBox();
          if (!pill || !tab) return Infinity;
          return Math.max(Math.abs(pill.x + pill.width / 2 - tab.x - tab.width / 2), Math.abs(pill.y + pill.height / 2 - tab.y - tab.height / 2));
        }).toBeLessThan(2);
      }
      if (hasWorkout) {
        await page.getByRole('tab', { name: 'Workout', exact: true }).click();
        await page.getByTestId('active-workout-list').evaluate(root => {
          const scroller = [root, ...root.querySelectorAll('*')].find(node => node.scrollHeight > node.clientHeight + 100 && /auto|scroll/.test(getComputedStyle(node).overflowY));
          if (!scroller) throw new Error('Missing workout scroller');
          scroller.scrollTop = 350;
          scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
        });
        await expect.poll(async () => (await page.getByTestId('dashboard-dock-cylinder').boundingBox())?.height ?? 68).toBeLessThan(55);
      }
      const dock = await page.getByTestId('dashboard-dock-cylinder').boundingBox();
      if (!dock) throw new Error('Missing dock');
      for (const name of tabs) {
        const tab = await page.getByRole('tab', { name, exact: true }).boundingBox();
        if (!tab) throw new Error(`Missing ${name}`);
        expect(Number(tab.width.toFixed(2))).toBeGreaterThanOrEqual(44);
        expect(Number(tab.height.toFixed(2))).toBeGreaterThanOrEqual(44);
        expect(tab.x).toBeGreaterThanOrEqual(dock.x);
        expect(tab.x + tab.width).toBeLessThanOrEqual(dock.x + dock.width + 1);
        expect(tab.y).toBeGreaterThanOrEqual(dock.y - 1);
        expect(tab.y + tab.height).toBeLessThanOrEqual(dock.y + dock.height + 1);
      }
      await page.screenshot({ path: testInfo.outputPath(`dock-${hasWorkout ? 'compact' : 'expanded'}-${appearance}.png`) });
    });
  }
}
