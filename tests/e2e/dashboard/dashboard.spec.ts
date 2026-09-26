import { expect, test, type Locator, type Page } from '@playwright/test';

/** Slides a card to the left to reveal its swipe-to-delete action. */
async function swipeCardLeft(page: Page, card: Locator): Promise<void> {
  const box = await card.boundingBox();
  if (!box) throw new Error('Expected a measurable card to swipe');
  const y = box.y + box.height / 2;
  const startX = box.x + box.width - 24;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(startX - 100, y, { steps: 12 });
  await page.mouse.up();
}

// The dashboard now ships empty and the user adds tiles themselves, so these
// tests seed the full set of tiles (the previous default) to exercise tile
// behaviour. The empty default + add flow is covered separately below.
const DASHBOARD_TILE_KINDS = [
  'start', 'week', 'training-time', 'last-workout', 'volume',
  'rest-stats', 'muscle-balance', 'consistency', 'streak', 'muscle-heatmap',
];
async function seedFullDashboard(page: Page): Promise<void> {
  // Only seed when nothing is saved yet, so a test that removes a tile and
  // reloads still sees its change persist (this init script re-runs per load).
  await page.addInitScript((kinds) => {
    if (localStorage.getItem('@forge/dashboard-layout-v1')) return;
    localStorage.setItem(
      '@forge/dashboard-layout-v1',
      JSON.stringify(kinds.map((kind) => ({ id: kind, kind, visible: true }))),
    );
  }, DASHBOARD_TILE_KINDS);
}

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await seedFullDashboard(page);
  });

  test('starts empty and adds a widget from the popup chooser', async ({ page }) => {
    // Override the seeded layout with the real empty default.
    await page.addInitScript((kinds) => {
      localStorage.setItem(
        '@forge/dashboard-layout-v1',
        JSON.stringify(kinds.map((kind) => ({ id: kind, kind, visible: false }))),
      );
    }, DASHBOARD_TILE_KINDS);
    await page.goto('/');

    await expect(page.getByText('Build your dashboard')).toBeVisible();
    await expect(page.getByTestId('dashboard-week-card')).toHaveCount(0);

    await page.getByRole('button', { name: 'Add widgets' }).click();
    await page.getByRole('button', { name: 'This week' }).click();
    await expect(page.getByTestId('dashboard-week-card')).toBeVisible();
  });

  test('matches the phone visual baseline', async ({ page }, testInfo) => {
    test.skip(testInfo.project.use.isMobile !== true, 'The baseline targets configured phone profiles.');
    await page.goto('/');

    await expect(page.getByTestId('dashboard-header-title')).toBeVisible();
    await expect(page.getByTestId('dashboard-start-card')).toBeVisible();
    await expect(page).toHaveScreenshot('dashboard.png', {
      fullPage: true,
      // The title is time-of-day dependent; the week strip and training-time
      // chart highlight "today", so all three drift with the clock.
      mask: [
        page.getByTestId('dashboard-header-title'),
        page.getByTestId('dashboard-week-card'),
        page.getByTestId('dashboard-training-time'),
      ],
    });
  });

  test('surfaces the summary cards computed from history', async ({ page }) => {
    await page.addInitScript(() => {
      const now = new Date();
      const noon = (offset: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset, 12).getTime();
      localStorage.setItem('@forge/completed-workouts', JSON.stringify([
        {
          id: 'seed-a', name: 'Push - Strength', type: 'Strength',
          startedAt: noon(1) - 3600_000, completedAt: noon(1), durationSeconds: 3600, note: '',
          exercises: [{ id: 'e1', name: 'Bench', sets: [{ id: 's1', weight: '100', reps: '5', completed: true }] }],
        },
      ]));
    });
    await page.goto('/');

    await expect(page.getByTestId('dashboard-start-card')).toBeVisible();
    await expect(page.getByTestId('dashboard-week-card')).toContainText('This week');
    await expect(page.getByTestId('dashboard-training-time')).toContainText('Training time');
    await expect(page.getByTestId('dashboard-last-workout')).toContainText('Push - Strength');
    await expect(page.getByTestId('dashboard-volume')).toContainText('500 kg');
  });

  test('opens the workout source chooser from the header action', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Start workout' }).first().click();
    const chooser = page.getByTestId('dashboard-workout-source-chooser');
    await expect(chooser).toBeVisible();
    await expect(chooser.getByRole('button', { name: 'Blank workout' })).toBeVisible();
    await expect(chooser.getByRole('button', { name: 'From routine or plan' })).toBeVisible();
  });

  test('starts the suggested routine directly from the hero', async ({ page }) => {
    await page.addInitScript(() => {
      const now = new Date();
      const noon = (offset: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset, 12).getTime();
      localStorage.setItem('@forge/completed-workouts', JSON.stringify([
        {
          id: 'seed-push', name: 'PPL - Push', type: 'Strength', planId: 'p1', routineId: 'r1',
          startedAt: noon(2) - 3600_000, completedAt: noon(2), durationSeconds: 3600, note: '', exercises: [],
        },
      ]));
      localStorage.setItem('@forge/plans-v1', JSON.stringify({
        plans: [{
          id: 'p1', name: 'PPL', createdAt: 0, updatedAt: 0, routines: [
            { id: 'r1', name: 'Push', type: 'Strength', exercises: [], createdAt: 0, updatedAt: 0 },
            { id: 'r2', name: 'Pull', type: 'Strength', exercises: [{ id: 'x', name: 'Row', sets: [{}, {}, {}] }], createdAt: 0, updatedAt: 0 },
          ],
        }],
        standaloneRoutines: [],
      }));
    });
    await page.goto('/');

    const hero = page.getByTestId('dashboard-start-card');
    await expect(hero).toContainText('Suggested workout');
    await expect(hero).toContainText('Pull');
    await hero.getByRole('button', { name: 'Start Pull' }).click();
    await expect(page.getByRole('tab', { name: 'Workout' })).toHaveAttribute('aria-selected', 'true');
  });

  test('opens a trained day from the week strip', async ({ page }) => {
    await page.addInitScript(() => {
      const now = new Date();
      const noon = (offset: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset, 12).getTime();
      localStorage.setItem('@forge/completed-workouts', JSON.stringify([
        {
          id: 'seed-day', name: 'Leg Day', type: 'Strength',
          startedAt: noon(0) - 3600_000, completedAt: noon(0), durationSeconds: 3600, note: '',
          exercises: [{ id: 'e1', name: 'Squat', sets: [{ id: 's1', weight: '120', reps: '5', completed: true }] }],
        },
      ]));
    });
    await page.goto('/');

    // Today's dot is trained; tapping it jumps straight to that session's detail.
    await page.getByTestId('dashboard-week-card').getByRole('button', { name: /workout$/ }).first().click();
    await expect(page.getByTestId('workout-details-summary-title')).toHaveText('Leg Day');
  });

  test('removes and re-adds a dashboard tile in edit mode, persisting across reloads', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page.getByTestId('dashboard-week-card')).toBeVisible();
    // No delete control outside edit mode.
    await expect(page.getByRole('button', { name: 'Delete This week tile' })).toHaveCount(0);

    // Enter edit mode from the header, then swipe the tile left and delete it.
    await page.getByRole('button', { name: 'Edit dashboard' }).click();
    await swipeCardLeft(page, page.getByTestId('dashboard-week-card'));
    if (testInfo.project.use.isMobile === true) {
      await page.screenshot({ path: testInfo.outputPath('tile-swipe-revealed.png') });
    }
    await page.getByRole('button', { name: 'Delete This week tile' }).click();
    await expect(page.getByTestId('dashboard-week-card')).toHaveCount(0);

    // The removal persists across a fresh load.
    await page.goto('/');
    await expect(page.getByTestId('dashboard-week-card')).toHaveCount(0);

    // Re-add it from the edit-mode Add tile chooser.
    await page.getByRole('button', { name: 'Edit dashboard' }).click();
    const addTile = page.getByRole('button', { name: 'Add tile' });
    await addTile.scrollIntoViewIfNeeded();
    await addTile.click();
    await page.getByRole('button', { name: 'This week' }).click();
    await expect(page.getByTestId('dashboard-week-card')).toBeVisible();
  });

  test('collapses the header to a single Done control while editing', async ({ page }, testInfo) => {
    await page.goto('/');
    const header = page.getByTestId('dashboard-header');
    await expect(header.getByRole('button', { name: 'Edit dashboard' })).toBeVisible();
    await expect(header.getByRole('button', { name: 'Start workout' })).toBeVisible();

    await header.getByRole('button', { name: 'Edit dashboard' }).click();
    // While editing there is only a Done control — no Start-workout to mis-tap.
    await expect(header.getByRole('button', { name: 'Done editing dashboard' })).toBeVisible();
    if (testInfo.project.use.isMobile === true) {
      await header.screenshot({ path: testInfo.outputPath('editing-header-done.png') });
    }
    await expect(header.getByRole('button', { name: 'Start workout' })).toHaveCount(0);
    await expect(header.getByRole('button', { name: 'Edit dashboard' })).toHaveCount(0);

    await header.getByRole('button', { name: 'Done editing dashboard' }).click();
    await expect(header.getByRole('button', { name: 'Start workout' })).toBeVisible();
    await expect(header.getByRole('button', { name: 'Done editing dashboard' })).toHaveCount(0);
  });

  test('uses one title baseline and typography across primary tabs', async ({ page }) => {
    await page.goto('/');
    const readTitle = async (locator: ReturnType<typeof page.locator>) =>
      locator.evaluate((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return {
          x: rect.x,
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          lineHeight: style.lineHeight,
          letterSpacing: style.letterSpacing,
          textShadow: style.textShadow,
        };
      });

    const dashboardTitle = await readTitle(page.getByTestId('dashboard-header-title'));
    await page.getByRole('tab', { name: 'History' }).click();
    const historyTitle = await readTitle(page.getByTestId('history-title'));
    await page.getByRole('tab', { name: 'Plans' }).click();
    const plansTitle = await readTitle(page.getByText('Plans', { exact: true }));
    await page.getByRole('tab', { name: 'Settings' }).click();
    const settingsTitle = await readTitle(page.getByTestId('settings-title'));

    for (const title of [historyTitle, plansTitle, settingsTitle]) {
      expect(Math.abs(title.x - dashboardTitle.x)).toBeLessThanOrEqual(3);
      expect(title.fontFamily).toBe(dashboardTitle.fontFamily);
      expect(title.fontSize).toBe(dashboardTitle.fontSize);
      expect(title.fontWeight).toBe(dashboardTitle.fontWeight);
      expect(title.lineHeight).toBe(dashboardTitle.lineHeight);
      expect(title.letterSpacing).toBe(dashboardTitle.letterSpacing);
      expect(title.textShadow).toBe(dashboardTitle.textShadow);
    }
  });

  test('keeps one persistent dock and moves its selected indicator between tabs', async ({ page }, testInfo) => {
    await page.goto('/');

    const dock = page.getByTestId('dashboard-dock-cylinder');
    const indicator = page.getByTestId('dashboard-nav-selection-pill');
    await expect(dock).toHaveCount(1);
    await expect(page.getByRole('tab', { name: 'Dashboard' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    const dashboardIndicator = await indicator.boundingBox();
    const dashboardIcon = await page
      .getByRole('tab', { name: 'Dashboard' })
      .locator('svg')
      .boundingBox();
    const inactiveHistoryIcon = await page
      .getByRole('tab', { name: 'History' })
      .locator('svg')
      .boundingBox();
    expect(dashboardIcon?.width).toBeGreaterThan(inactiveHistoryIcon?.width ?? 0);
    await page.getByRole('tab', { name: 'History' }).click();
    await expect(page.getByTestId('history-title')).toBeVisible();
    await expect(dock).toHaveCount(1);
    await expect(page.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true');
    await expect(indicator).toBeVisible();
    await page.waitForTimeout(180);
    const historyIndicator = await indicator.boundingBox();
    const historyIcon = await page
      .getByRole('tab', { name: 'History' })
      .locator('svg')
      .boundingBox();
    const inactiveDashboardIcon = await page
      .getByRole('tab', { name: 'Dashboard' })
      .locator('svg')
      .boundingBox();
    expect(historyIcon?.width).toBeGreaterThan(inactiveDashboardIcon?.width ?? 0);

    await page.getByRole('tab', { name: 'History' }).click();
    await expect(page.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true');
    const retainedHistoryIndicator = await indicator.boundingBox();

    expect(dashboardIndicator).not.toBeNull();
    expect(historyIndicator).not.toBeNull();
    expect(retainedHistoryIndicator).not.toBeNull();
    expect(historyIndicator?.x).toBeGreaterThan(dashboardIndicator?.x ?? 0);
    expect(retainedHistoryIndicator?.x).toBeCloseTo(historyIndicator?.x ?? 0, 0);

    // The selected capsule is measured from each tab's actual slot. Validate
    // every no-workout root rather than assuming equal four-tab arithmetic.
    for (const tabName of ['Dashboard', 'History', 'Plans', 'Settings']) {
      await page.getByRole('tab', { name: tabName }).click();
      await page.waitForTimeout(180);
      const activeTab = await page.getByRole('tab', { name: tabName }).boundingBox();
      const activeIndicator = await indicator.boundingBox();
      expect(activeTab).not.toBeNull();
      expect(activeIndicator).not.toBeNull();
      if (!activeTab || !activeIndicator) throw new Error('Expected dock geometry');
      expect(Math.abs((activeIndicator.x + activeIndicator.width / 2) - (activeTab.x + activeTab.width / 2))).toBeLessThanOrEqual(3);
    }
    if (testInfo.project.use.isMobile === true) await page.screenshot({ path: testInfo.outputPath('four-tab-selection-centred-phone.png'), fullPage: true });
  });

  test('keeps the five-tab dock selection centred during an active workout', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Start workout' }).first().click();
    await page
      .getByTestId('dashboard-workout-source-chooser')
      .getByRole('button', { name: 'Blank workout' })
      .click();
    await expect(page.getByTestId('add-exercise-catalogue')).toBeVisible();
    await page
      .getByTestId('add-exercise-sheet-surface')
      .getByRole('button', { name: 'Close add exercises' })
      .click();

    const indicator = page.getByTestId('dashboard-nav-selection-pill');
    for (const tabName of ['Dashboard', 'History', 'Workout', 'Plans', 'Settings']) {
      await page.getByRole('tab', { name: tabName }).click();
      await page.waitForTimeout(180);
      const activeTab = await page.getByRole('tab', { name: tabName }).boundingBox();
      const activeIndicator = await indicator.boundingBox();
      expect(activeTab).not.toBeNull();
      expect(activeIndicator).not.toBeNull();
      if (!activeTab || !activeIndicator) throw new Error('Expected active-workout dock geometry');
      expect(
        Math.abs(
          activeIndicator.x + activeIndicator.width / 2 - (activeTab.x + activeTab.width / 2),
        ),
      ).toBeLessThanOrEqual(3);
    }
    if (testInfo.project.use.isMobile === true) {
      await page.screenshot({ path: testInfo.outputPath('five-tab-selection-centred-phone.png'), fullPage: true });
    }
  });

  test('uses the Forge semantic scale for page and supporting text', async ({ page }) => {
    await page.goto('/');

    const readTextMetrics = async (locator: ReturnType<typeof page.locator>) =>
      locator.evaluate((element) => {
        const style = window.getComputedStyle(element);
        return { fontSize: style.fontSize, lineHeight: style.lineHeight };
      });

    await expect(page.getByTestId('dashboard-header-title')).toBeVisible();
    const sectionTitle = page.getByText('This week', { exact: true });
    await expect(sectionTitle).toBeVisible();
    expect(await readTextMetrics(page.getByTestId('dashboard-header-title'))).toEqual({
      fontSize: '31px',
      lineHeight: '36px',
    });
    expect(await readTextMetrics(sectionTitle)).toEqual({
      fontSize: '18px',
      lineHeight: '24px',
    });
    await page.getByRole('tab', { name: 'History' }).click();
    expect(await readTextMetrics(page.getByTestId('history-title'))).toEqual({
      fontSize: '31px',
      lineHeight: '36px',
    });
  });
});
