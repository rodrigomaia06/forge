import { expect, test } from '@playwright/test';

test.describe('Settings', () => {
  async function expectRowHeight(
    locator: import('@playwright/test').Locator,
    expectedHeight: number,
  ): Promise<void> {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.height).toBeCloseTo(expectedHeight, 0);
  }

  async function expectFontSize(
    locator: import('@playwright/test').Locator,
    expectedSize: number,
  ): Promise<void> {
    await expect(locator).toBeVisible();
    expect(await locator.evaluate((element) => window.getComputedStyle(element).fontSize)).toBe(
      `${expectedSize}px`,
    );
  }

  async function openWorkoutTypes(page: import('@playwright/test').Page): Promise<void> {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Workout types' }).click();
  }

  async function scrollTop(locator: import('@playwright/test').Locator): Promise<number> {
    return locator.evaluate((element) => {
      const nodes: HTMLElement[] = [element as HTMLElement, ...Array.from(element.querySelectorAll<HTMLElement>('*'))];
      for (let parent = element.parentElement; parent; parent = parent.parentElement) nodes.push(parent);
      const scroller = nodes.find((node) => {
        const style = window.getComputedStyle(node);
        return node.scrollHeight > node.clientHeight + 24 && /auto|scroll/.test(style.overflowY);
      });
      if (!scroller) throw new Error('Expected a vertically scrollable Settings list');
      return scroller.scrollTop;
    });
  }

  async function scrollListDown(locator: import('@playwright/test').Locator): Promise<void> {
    await locator.evaluate((element) => {
      const nodes: HTMLElement[] = [element as HTMLElement, ...Array.from(element.querySelectorAll<HTMLElement>('*'))];
      for (let parent = element.parentElement; parent; parent = parent.parentElement) nodes.push(parent);
      const scroller = nodes.find((node) => {
        const style = window.getComputedStyle(node);
        return node.scrollHeight > node.clientHeight + 24 && /auto|scroll/.test(style.overflowY);
      });
      if (!scroller) throw new Error('Expected a vertically scrollable Settings list');
      scroller.scrollBy({ top: Math.max(180, scroller.clientHeight * 0.5) });
      scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
    });
  }

  test('shows grouped settings and opens each destination', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();

    await expect(page.getByTestId('settings-title')).toBeVisible();
    await expect(page.getByTestId('settings-title')).toHaveText('More');
    await page.waitForTimeout(300);
    await page.screenshot({ path: testInfo.outputPath('more-screen-title.png') });
    await expect(page.getByRole('button', { name: 'Muscle heatmap' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Exercises' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Workout types' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Measurements' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'General' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Backup & Export' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Logs' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'About' })).toBeVisible();
    // Insights (Muscle heatmap, Measurements) sits above the Exercises group.
    const heatmapBox = await page.getByRole('button', { name: 'Muscle heatmap' }).boundingBox();
    const measurementsBox = await page.getByRole('button', { name: 'Measurements' }).boundingBox();
    const exercisesBox = await page.getByRole('button', { name: 'Exercises' }).boundingBox();
    expect(heatmapBox?.y ?? Infinity).toBeLessThan(measurementsBox?.y ?? -Infinity);
    expect(measurementsBox?.y ?? Infinity).toBeLessThan(exercisesBox?.y ?? -Infinity);

    await page.getByRole('button', { name: 'Exercises' }).click();
    await expect(page.getByTestId('settings-detail-title')).toHaveText('Exercises');
    const exerciseLibrary = page.getByTestId('exercise-library-screen');
    const exerciseLibraryBox = await exerciseLibrary.boundingBox();
    expect(exerciseLibraryBox?.height ?? 0).toBeCloseTo(page.viewportSize()?.height ?? 0, 0);
    await expect(page.getByRole('button', { name: 'All exercises, 608 exercises' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Strength, \d+ exercises$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Mobility, \d+ exercises$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Cardio, \d+ exercises$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Court sport, \d+ exercises$/ })).toBeVisible();
    await page.getByRole('button', { name: /^Strength, \d+ exercises$/ }).click();
    await expect(page.getByTestId('settings-detail-title').last()).toHaveText('Strength');
    await page.getByRole('button', { name: 'Back to Exercises' }).click();
    await page.getByRole('button', { name: 'Back to Settings' }).click();
    await expect(page.getByTestId('settings-title')).toBeVisible();

    await page.getByRole('button', { name: 'Workout types' }).click();
    await expect(page.getByTestId('settings-detail-title')).toHaveText('Workout types');
    await page.getByRole('button', { name: 'Strength workout type' }).click();
    await expect(
      page.getByRole('switch', { name: 'Show Strength in workout pickers' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Workout type color', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Back to Workout types' }).click();
    await page.getByRole('button', { name: 'Back to Settings' }).click();

    await page.getByRole('button', { name: 'Backup & Export' }).click();
    await expect(page.getByTestId('settings-detail-title')).toHaveText('Backup & Export');
    await expect(page.getByRole('button', { name: 'Import data' })).toBeVisible();
    await page.getByRole('button', { name: 'Back to Settings' }).click();

    await page.getByRole('button', { name: 'About' }).click();
    await expect(page.getByTestId('settings-detail-title')).toHaveText('About');
  });

  for (const appearance of ['light', 'dark']) {
    test(`unlocks and hides Logs with three About logo presses (${appearance})`, async ({ page }, testInfo) => {
      await page.addInitScript((appearance) => {
        if (!localStorage.getItem('@forge/settings-preferences')) {
          localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance }));
        }
      }, appearance);
      await page.goto('/');
      await page.getByRole('tab', { name: 'Settings', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Logs', exact: true })).toHaveCount(0);
      await page.waitForTimeout(300);
      await page.screenshot({ path: testInfo.outputPath('logs-hidden.png') });
      await page.getByRole('button', { name: 'About', exact: true }).click();
      const logo = page.getByRole('button', { name: 'Forge logo', exact: true });
      await logo.click();
      await logo.click();
      await expect(page.getByTestId('logs-toggle-notice')).toHaveCount(0);
      await logo.click();
      const notice = page.getByTestId('logs-toggle-notice');
      await expect(notice).toContainText('Logs enabled');
      await page.waitForTimeout(300);
      await page.screenshot({ path: testInfo.outputPath('logs-enabled-notice.png') });
      await notice.getByRole('button', { name: 'Done', exact: true }).click();
      await page.getByRole('button', { name: 'Back to Settings', exact: true }).click();
      await page.getByRole('button', { name: 'Logs', exact: true }).click();
      await expect(page.getByTestId('settings-detail-title')).toHaveText('Logs');
      await page.goto('/');
      await page.getByRole('tab', { name: 'Settings', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Logs', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'About', exact: true }).click();
      await logo.click();
      await logo.click();
      await expect(notice).toHaveCount(0);
      await logo.click();
      await expect(notice).toContainText('Logs disabled');
      await page.waitForTimeout(300);
      await page.screenshot({ path: testInfo.outputPath('logs-disabled-notice.png') });
      await notice.getByRole('button', { name: 'Done', exact: true }).click();
      await page.goto('/');
      await page.getByRole('tab', { name: 'Settings', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Logs', exact: true })).toHaveCount(0);
    });
  }

  test('starts Measurements empty, then records and persists body weight with history', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Measurements' }).click();

    await expect(page.getByTestId('settings-detail-title')).toHaveText('Measurements');
    await expect(page.getByRole('button', { name: 'Record body weight' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Add measure', exact: true }).last().click();
    const addClose = page.getByTestId('forge-sheet-drag-area').getByRole('button', { name: 'Close Add measure' });
    const addCloseBox = await addClose.boundingBox();
    await page.getByLabel('Measure name').fill('Body weight');
    await page.getByLabel('Measure unit').fill('kg');
    await page.getByRole('button', { name: 'Add measure', exact: true }).last().click();
    await expect(page.getByRole('button', { name: 'Record body weight' })).toBeVisible();

    await page.getByRole('button', { name: 'Record measurement' }).click();
    const recordCloseBox = await page.getByTestId('forge-sheet-drag-area').getByRole('button', { name: 'Close Record Body weight' }).boundingBox();
    expect(addCloseBox).not.toBeNull();
    expect(recordCloseBox).not.toBeNull();
    expect((addCloseBox?.x ?? 0) + (addCloseBox?.width ?? 0)).toBeCloseTo(
      (recordCloseBox?.x ?? 0) + (recordCloseBox?.width ?? 0),
      0,
    );
    await page.getByLabel('Body weight value').fill('81.4');
    await page.getByRole('button', { name: 'Save measurement' }).click();
    await expect(page.getByText('81.4 kg').first()).toBeVisible();
    await expect(page.getByText('Trend', { exact: true })).toBeVisible();
    // The swipe-to-delete hint only appears once editing is enabled.
    await page.getByRole('button', { name: 'Edit measurements' }).click();
    await expect(page.getByText('Tap to edit · swipe to delete')).toBeVisible();

    // The static webServer has no SPA fallback, so reload the app root (which
    // preserves localStorage) instead of page.reload() on the deep settings route.
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Measurements' }).click();
    // Entering the destination never fades or translates its initial metric.
    await expect(page.getByTestId('measurements-active-metric')).toHaveCSS('opacity', '1');
    await expect(page.getByText('81.4 kg').first()).toBeVisible();
    await page.getByRole('button', { name: 'Edit measurements' }).click();
    await expect(page.getByText('Tap to edit · swipe to delete')).toBeVisible();
  });

  test('keeps measures user-defined and lets the user choose their chart colour', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Measurements' }).click();

    await page.getByRole('button', { name: 'Add measure', exact: true }).last().click();
    await expect(page.getByText('SUGGESTED', { exact: true })).toHaveCount(0);
    const blue = page.getByRole('radio', { name: 'Use Blue color' });
    await blue.click();
    await expect(blue).toHaveAttribute('aria-checked', 'true');
    await page.getByLabel('Measure name').fill('Body fat');
    await page.getByLabel('Measure unit').fill('%');
    await page.getByRole('button', { name: 'Add measure', exact: true }).last().click();
    await expect(page.getByRole('radio', { name: 'Body fat' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Record body fat' })).toBeVisible();
  });

  test('keeps vertical scrolling available from interactive Settings rows', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Exercises' }).click();
    await page.getByRole('button', { name: 'Strength, 265 exercises' }).click();

    const exerciseBrowser = page.getByTestId('exercise-browser-scroll');
    const exerciseBrowserBefore = await scrollTop(exerciseBrowser);
    await scrollListDown(exerciseBrowser);
    await expect.poll(() => scrollTop(exerciseBrowser)).toBeGreaterThan(exerciseBrowserBefore + 20);

    await page.getByRole('button', { name: 'Back to Exercises' }).click();
    await page.getByRole('button', { name: 'Back to Settings' }).click();
    await page.getByRole('button', { name: 'General' }).click();
    const generalSettings = page.getByTestId('general-settings-scroll');
    const generalSettingsBefore = await scrollTop(generalSettings);
    await scrollListDown(generalSettings);
    await expect.poll(() => scrollTop(generalSettings)).toBeGreaterThan(generalSettingsBefore + 20);
  });

  test('keeps expanded exercise variations on their opaque card surface in Light', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Exercises' }).click();
    await page.getByRole('button', { name: 'Strength, 265 exercises' }).click();
    await page.getByRole('button', { name: 'Bench Press & 3 variations' }).click();

    const expansion = page.getByTestId('exercise-variations-Bench Press');
    await expect(expansion).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(expansion).toHaveCSS('border-top-width', '1px');
  });

  test('uses the shared Settings row scale across root and nested cards', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();

    const rootRow = page.getByTestId('settings-main-exercises-row');
    await expectRowHeight(rootRow, 56);
    await expectFontSize(page.getByTestId('settings-main-exercises-row-title'), 16);
    const rootCard = await rootRow.evaluate((element) => {
      const parent = element.parentElement;
      const box = parent?.getBoundingClientRect();
      return {
        x: box?.x,
        width: box?.width,
        radius: parent ? window.getComputedStyle(parent).borderRadius : null,
      };
    });
    expect(rootCard.x).toBeCloseTo(20, 0);
    expect(rootCard.width).toBeCloseTo((page.viewportSize()?.width ?? 40) - 40, 0);
    expect(rootCard.radius).toBe('24px');

    await rootRow.click();
    const libraryRow = page.getByTestId('exercise-library-type-strength');
    await expectRowHeight(libraryRow, 68);
    await expectFontSize(page.getByTestId('exercise-library-type-strength-title'), 16);
    await page.getByRole('button', { name: 'All exercises, 608 exercises' }).click();
    const movementRow = page.getByRole('button', { name: 'Bench Press & 3 variations' });
    await expectRowHeight(movementRow, 68);
    await expectFontSize(page.getByText('Bench Press', { exact: true }), 16);

    await page.getByRole('button', { name: 'Back to Exercises' }).click();
    await page.getByRole('button', { name: 'Back to Settings' }).click();
    await page.getByRole('button', { name: 'Workout types' }).click();
    await expectRowHeight(page.getByRole('button', { name: 'Strength workout type' }), 56);

    await page.getByRole('button', { name: 'Back to Settings' }).click();
    await page.getByRole('button', { name: 'General' }).click();
    await expectRowHeight(page.getByRole('radio', { name: 'Metric (kg)' }), 56);
    await expectFontSize(page.getByText('Metric (kg)', { exact: true }), 16);

    await page.getByRole('button', { name: 'Back to Settings' }).click();
    await page.getByRole('button', { name: 'Backup & Export' }).click();
    await expectRowHeight(page.getByRole('button', { name: 'Export data' }), 56);
    await expectRowHeight(page.getByRole('button', { name: 'Create backup' }), 56);
    await expect(page.getByRole('button', { name: 'Delete all app data' })).toBeVisible();
    await expectFontSize(page.getByText('Export data', { exact: true }), 16);

    await page.getByRole('button', { name: 'Back to Settings' }).click();
    await page.getByRole('button', { name: 'About' }).click();
    await expectRowHeight(page.getByRole('button', { name: 'Source code' }), 56);
  });

  test('uses the enlarged semantic icon scale on Settings and About rows', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await expect(page.getByTestId('settings-main-exercises-row').locator('svg').first()).toHaveAttribute('width', '26');

    await page.getByRole('button', { name: 'About' }).click();
    await expect(page.getByRole('button', { name: 'Source code' }).locator('svg').first()).toHaveAttribute('width', '26');
    await expect(page.getByRole('button', { name: 'License: GPL v3.0' }).locator('svg').first()).toHaveAttribute('width', '26');
  });

  test('chooses portable data before exporting JSON', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Backup & Export' }).click();
    await page.getByRole('button', { name: 'Export data' }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByText('Export data', { exact: true })).toBeVisible();
    await expect(sheet.getByRole('checkbox', { name: 'Remove Workouts' })).toBeChecked();
    await sheet.getByRole('checkbox', { name: 'Remove Measurements' }).click();
    await expect(sheet.getByRole('checkbox', { name: 'Include Measurements' })).not.toBeChecked();
    await expect(sheet.getByRole('button', { name: 'Export selected data' })).toBeVisible();
    if (testInfo.project.use.isMobile === true) {
      await page.screenshot({ path: testInfo.outputPath('export-data-selection-iphone.png') });
    }
  });

  test('opens the per-item import screen for a data dump and imports the selection', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Backup & Export' }).click();
    const chooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Import data' }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles({
      name: 'forge-import.forge',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({
        format: 'forge-data', version: 1, exportedAt: '2026-09-13T00:00:00.000Z',
        settings: { workoutTypes: [], dailyMeasurementDefinitions: [], dailyMeasurementEntries: [] },
        plans: {
          plans: [
            { name: 'Plan A', createdAt: 0, updatedAt: 0, routines: [{ name: 'Routine A', type: 'Strength', createdAt: 0, updatedAt: 0 }, { name: 'Routine B', type: 'Strength', exercises: [], createdAt: 0, updatedAt: 0 }] },
            { name: 'Plan B', createdAt: 0, updatedAt: 0, routines: [{ name: 'Routine C', type: 'Strength', exercises: [], createdAt: 0, updatedAt: 0 }, { name: 'Routine D', type: 'Strength', exercises: [], createdAt: 0, updatedAt: 0 }] },
          ],
          standaloneRoutines: [{ name: 'Routine E', type: 'Strength', exercises: [], createdAt: 0, updatedAt: 0 }],
        },
        workouts: { activeWorkout: null, completedWorkouts: [] }, customExercises: [],
      })),
    });
    // A full dump opens the dedicated per-item screen, showing only non-empty categories.
    await expect(page.getByTestId('settings-detail-title').last()).toHaveText('Import');
    await expect(page.getByRole('button', { name: /Plans, 2 of 2 selected/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Routines, 1 of 1 selected/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Workouts,/ })).toHaveCount(0);
    // Expand Routines and drop it from the selection, keeping the two plans.
    await page.getByRole('button', { name: /Routines, 1 of 1 selected/ }).click();
    await page.getByRole('checkbox', { name: 'Deselect all Routines' }).click();
    await expect(page.getByRole('button', { name: /Routines, 0 of 1 selected/ })).toBeVisible();
    await page.getByRole('button', { name: /Import 2 items/ }).click();
    const summary = page.getByTestId('import-selection-summary');
    await expect(summary).toBeVisible();
    await expect(summary).toContainText('plans and routines');
    await summary.getByRole('button', { name: 'Done' }).click();
    // Done returns to Backup & Export (a full-screen detail); step back to the
    // Settings root before reaching for the Plans tab.
    await page.getByRole('button', { name: 'Back to Settings' }).click();
    await page.getByRole('tab', { name: 'Plans' }).click();
    await expect(page.getByText('Routine A', { exact: true })).toBeVisible();
    // Routine E was deselected, so it is not imported.
    await expect(page.getByText('Routine E', { exact: true })).toHaveCount(0);
  });

  test('imports a shared single routine straight from a review, skipping the category grid', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Backup & Export' }).click();
    const chooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Import data' }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles({
      name: 'forge-push-day.forge',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({
        format: 'forge-data', version: 1, exportedAt: '2026-09-13T00:00:00.000Z',
        share: { kind: 'routine', title: 'Push Day', summary: '1 exercise' },
        // A scoped share declares exactly which sections it carries.
        selection: { workouts: false, plans: true, exercises: false, workoutTypes: false, measurements: false },
        settings: { workoutTypes: [], dailyMeasurementDefinitions: [], dailyMeasurementEntries: [] },
        plans: { plans: [], standaloneRoutines: [{ name: 'Push Day', type: 'Strength', exercises: [], createdAt: 0, updatedAt: 0 }] },
        workouts: { activeWorkout: null, completedWorkouts: [] }, customExercises: [],
      })),
    });
    const sheet = page.getByRole('dialog');
    // A single shared item skips the generic category grid and lands straight on
    // the review, which names the item and shows only what it carries.
    await expect(sheet.getByText('Push Day', { exact: true })).toBeVisible();
    await expect(sheet.getByText(/Shared routine/)).toBeVisible();
    await expect(sheet.getByText('Review import', { exact: true })).toBeVisible();
    await expect(sheet.getByRole('checkbox', { name: 'Remove Plans & routines' })).toHaveCount(0);
    await expect(sheet.getByText('Workouts', { exact: true })).toHaveCount(0);
    await sheet.getByRole('button', { name: 'Import selected data' }).click();
    await expect(page.getByTestId('data-merged-summary')).toBeVisible();
    await page.getByTestId('data-merged-summary').getByRole('button', { name: 'Done' }).click();
    await page.getByRole('button', { name: 'Back to Settings' }).click();
    await page.getByRole('tab', { name: 'Plans' }).click();
    await expect(page.getByText('Push Day', { exact: true })).toBeVisible();
  });

  // Shared-routine imports funnel into one helper: open the picker, feed a
  // Push Day `.forge`, and return the review sheet so each caller drives its own
  // decision (plain Import, or an Update / Keep both conflict choice).
  async function openPushDayImport(
    page: import('@playwright/test').Page,
    exercises: unknown[],
  ): Promise<import('@playwright/test').Locator> {
    const chooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Import data' }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles({
      name: 'push.forge',
      mimeType: 'application/json',
      // No routine id, so each import gets a fresh id (a new routine, not an update).
      buffer: Buffer.from(JSON.stringify({
        format: 'forge-data', version: 1, exportedAt: '2026-09-13T00:00:00.000Z',
        share: { kind: 'routine', title: 'Push Day', summary: '1 exercise' },
        selection: { workouts: false, plans: true, exercises: false, workoutTypes: false, measurements: false },
        settings: { workoutTypes: [], dailyMeasurementDefinitions: [], dailyMeasurementEntries: [] },
        plans: { plans: [], standaloneRoutines: [{ name: 'Push Day', type: 'Strength', exercises, createdAt: 0, updatedAt: 0 }] },
        workouts: { activeWorkout: null, completedWorkouts: [] }, customExercises: [],
      })),
    });
    return page.getByRole('dialog');
  }

  test('skips an identical re-import and keeps a different same-named one as a copy', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Backup & Export' }).click();
    // First import into an empty library: a brand-new routine, plain review.
    const firstSheet = await openPushDayImport(page, []);
    await firstSheet.getByRole('button', { name: 'Import selected data' }).click();
    const first = page.getByTestId('data-merged-summary');
    await expect(first).toBeVisible();
    await first.getByRole('button', { name: 'Done' }).click();
    // A content-identical re-import is skipped, not duplicated as "Push Day 2".
    const secondSheet = await openPushDayImport(page, []);
    await secondSheet.getByRole('button', { name: 'Import selected data' }).click();
    const second = page.getByTestId('data-merged-summary');
    await expect(second).toContainText('already on this device');
    await second.getByRole('button', { name: 'Done' }).click();
    // A same-named but genuinely different routine is now a conflict, which
    // routes to the dedicated review screen instead of the in-sheet popup. Keep
    // both preserves the on-device copy behaviour (a numbered "Push Day 2").
    await openPushDayImport(page, [{ id: 'e1', name: 'Bench Press', sets: [] }]);
    await expect(page.getByTestId('settings-detail-title').last()).toHaveText('Review update');
    await page.getByRole('button', { name: 'Keep both' }).click();
    const third = page.getByTestId('import-conflict-summary');
    await expect(third).toContainText('Kept as a separate copy');
    await expect(third).toContainText('Push Day 2');
    await third.getByRole('button', { name: 'Done' }).click();
    await page.getByRole('button', { name: 'Back to Settings' }).click();
    await page.getByRole('tab', { name: 'Plans' }).click();
    await expect(page.getByText('Push Day', { exact: true })).toBeVisible();
    await expect(page.getByText('Push Day 2', { exact: true })).toBeVisible();
  });

  test('applies only the checked changes for a shared routine on a dedicated review screen', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Backup & Export' }).click();
    // Seed a Push Day routine on device with two exercises (new item → plain review).
    const seedSheet = await openPushDayImport(page, [
      { id: 'e1', name: 'Bench Press', sets: [] },
      { id: 'e2', name: 'Squat', sets: [] },
    ]);
    await seedSheet.getByRole('button', { name: 'Import selected data' }).click();
    await page.getByTestId('data-merged-summary').getByRole('button', { name: 'Done' }).click();
    // Import a same-named routine that keeps Bench Press, drops Squat and adds
    // Overhead Press: the conflict opens the dedicated per-change review screen.
    await openPushDayImport(page, [
      { id: 'e1', name: 'Bench Press', sets: [] },
      { id: 'e3', name: 'Overhead Press', sets: [] },
    ]);
    await expect(page.getByTestId('settings-detail-title').last()).toHaveText('Review update');
    const conflictScreen = page.getByTestId('import-conflict-screen');
    await expect(conflictScreen.getByText('This replaces the routine already on this device.')).toBeVisible();
    // Grouped, per-change checkbox rows — only the changed children appear, each
    // with the item's contextual (barbell) icon; unchanged Bench Press has no row.
    await expect(conflictScreen.getByText('Exercises', { exact: true })).toBeVisible();
    await expect(conflictScreen.getByRole('checkbox', { name: 'Overhead Press' })).toBeVisible();
    await expect(conflictScreen.getByRole('checkbox', { name: 'Squat' })).toBeVisible();
    await expect(conflictScreen.getByRole('checkbox', { name: 'Bench Press' })).toHaveCount(0);
    await expect(conflictScreen.getByTestId('import-conflict-lead-icon')).toBeVisible();
    await expect(conflictScreen.getByTestId('import-conflict-icon-child:added:overhead press')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Keep both' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Skip' })).toBeVisible();
    // Uncheck the "added Overhead Press" change, then Update: it must NOT be
    // applied, while the still-checked "removed Squat" is.
    await conflictScreen.getByRole('checkbox', { name: 'Overhead Press' }).click();
    await page.getByRole('button', { name: 'Update' }).click();
    const updated = page.getByTestId('import-conflict-summary');
    await expect(updated).toContainText('Updated');
    await updated.getByRole('button', { name: 'Done' }).click();
    await page.getByRole('button', { name: 'Back to Settings' }).click();
    await page.getByRole('tab', { name: 'Plans' }).click();
    // In place (no "Push Day 2"); only Bench Press remains — Squat removed,
    // Overhead Press excluded — so the routine now carries a single exercise.
    await expect(page.getByText('Push Day', { exact: true })).toHaveCount(1);
    await expect(page.getByText('Push Day 2', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Strength · 1 exercise', { exact: true })).toBeVisible();

    // All-checked Update fully replaces in place: swap the single exercise for two.
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Backup & Export' }).click();
    await openPushDayImport(page, [
      { id: 'e4', name: 'Overhead Press', sets: [] },
      { id: 'e5', name: 'Lateral Raise', sets: [] },
    ]);
    await expect(page.getByTestId('settings-detail-title').last()).toHaveText('Review update');
    await page.getByRole('button', { name: 'Update' }).click();
    await expect(page.getByTestId('import-conflict-summary')).toContainText('Updated');
    await page.getByTestId('import-conflict-summary').getByRole('button', { name: 'Done' }).click();
    await page.getByRole('button', { name: 'Back to Settings' }).click();
    await page.getByRole('tab', { name: 'Plans' }).click();
    await expect(page.getByText('Push Day', { exact: true })).toHaveCount(1);
    await expect(page.getByText('Strength · 2 exercises', { exact: true })).toBeVisible();

    // A further different import, resolved with Keep both, yields the copy instead.
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Backup & Export' }).click();
    await openPushDayImport(page, [{ id: 'e6', name: 'Deadlift', sets: [] }]);
    await expect(page.getByTestId('settings-detail-title').last()).toHaveText('Review update');
    await page.getByRole('button', { name: 'Keep both' }).click();
    await expect(page.getByTestId('import-conflict-summary')).toContainText('Push Day 2');
    await page.getByTestId('import-conflict-summary').getByRole('button', { name: 'Done' }).click();
    await page.getByRole('button', { name: 'Back to Settings' }).click();
    await page.getByRole('tab', { name: 'Plans' }).click();
    await expect(page.getByText('Push Day 2', { exact: true })).toBeVisible();
  });

  test('uses a Forge decision card when data transfer cannot complete', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Backup & Export' }).click();
    const chooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Import data' }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles({
      name: 'not-forge.forge',
      mimeType: 'application/json',
      buffer: Buffer.from('{not-valid-json'),
    });
    const notice = page.getByTestId('backup-export-notice');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('Could not complete this action');
    await expect(notice.getByRole('button', { name: 'Done' })).toBeVisible();
    if (testInfo.project.use.isMobile === true) {
      await page.waitForTimeout(250);
      await page.screenshot({ path: testInfo.outputPath('backup-export-error-forge-iphone.png') });
    }
    await notice.getByRole('button', { name: 'Done' }).click();
    await expect(notice).toBeHidden();
  });

  test('uses the Forge destructive confirmation card before deleting app data', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Backup & Export' }).click();
    await page.getByRole('button', { name: 'Delete all app data' }).click();
    const confirmation = page.getByTestId('delete-all-data-confirmation');
    await expect(confirmation).toBeVisible();
    await expect(confirmation.getByRole('button', { name: 'Keep data' })).toBeVisible();
    await expect(confirmation.getByRole('button', { name: 'Delete all data' })).toBeVisible();
    await confirmation.getByRole('button', { name: 'Delete all data' }).click();
    const complete = page.getByTestId('delete-all-data-complete');
    await expect(complete).toBeVisible();
    await expect(complete.getByRole('button', { name: 'Done' })).toBeVisible();
    await complete.getByRole('button', { name: 'Done' }).click();
    await expect(complete).toBeHidden();
  });

  test('persists the first day of the week and applies it to the Calendar', async ({ page }) => {
    // The dashboard now starts empty; seed the week tile so the week-start
    // setting can be verified on it.
    await page.addInitScript(() => {
      localStorage.setItem(
        '@forge/dashboard-layout-v1',
        JSON.stringify([
          { id: 'start', kind: 'start', visible: true },
          { id: 'week', kind: 'week', visible: true },
        ]),
      );
    });
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'General' }).click();
    await page.getByRole('radio', { name: 'Sunday' }).click();
    await page.getByRole('button', { name: 'Back to Settings' }).click();
    await expect(page.getByRole('button', { name: 'General' })).toBeVisible();

    await page.getByRole('tab', { name: 'Dashboard' }).click();
    await expect(page.getByTestId('dashboard-week-card')).toBeVisible();
    await expect(page.getByTestId('dashboard-week-labels')).toHaveText('SMTWTFS');
    // Reload from root: tab navigation leaves the URL on a sub-path the static
    // web server has no SPA fallback for, and a fresh load still proves the
    // setting persisted (it lives in web storage).
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'General' }).click();
    await expect(page.getByRole('radio', { name: 'Sunday' })).toBeVisible();
  });

  test('uses the shared single-choice picker for General selections', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'General' }).click();

    // Rest durations are picked on the shared wheel inside a bottom sheet.
    await page.getByRole('button', { name: 'Default rest time' }).click();
    const restSheet = page.getByTestId('default-rest-sheet-surface');
    await expect(restSheet).toBeVisible();
    await page.waitForTimeout(120);
    // 01:40 sits two rows below the 01:30 default, within the wheel's window.
    await restSheet.getByRole('button', { name: 'Rest duration 01:40' }).click();
    await page.getByRole('button', { name: 'Close default rest time picker' }).click();
    await expect(page.getByRole('button', { name: 'Default rest time' })).toContainText('01:40');

    // Discrete reminder options use the shared single-select list in a sheet.
    await page.getByRole('switch', { name: 'Unfinished workout reminder' }).click();
    await page.getByRole('button', { name: 'Remind after' }).click();
    const reminderSheet = page.getByTestId('reminder-sheet-surface');
    await expect(reminderSheet).toBeVisible();
    await expect(reminderSheet.getByRole('radiogroup')).toBeVisible();
    await reminderSheet.getByRole('radio', { name: '1 hour' }).click();
    await expect(page.getByTestId('reminder-sheet-surface')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Remind after' })).toContainText('1 hour');

    // Appearance is an inline segmented switcher (System / Light / Dark).
    const readAppearance = () =>
      page.evaluate(() => JSON.parse(localStorage.getItem('@forge/settings-preferences') ?? '{}').appearance);
    await expect(page.getByRole('radiogroup', { name: 'Appearance' })).toBeVisible();
    expect((await page.getByRole('radiogroup', { name: 'Appearance' }).boundingBox())!.height).toBeLessThanOrEqual(44);
    await page.getByRole('radio', { name: 'Light' }).click();
    await expect.poll(readAppearance).toBe('light');
    await page.waitForTimeout(300);
    await page.screenshot({ path: testInfo.outputPath('compact-appearance-light.png') });
    const capturePressTint = async (name: string, appearance: string) => {
      const option = page.getByRole('radio', { name, exact: true });
      const target = (await option.boundingBox())!;
      expect(target.height).toBe(44);
      await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2);
      await page.mouse.down();
      const tint = option.getByTestId('forge-press-state-layer');
      await expect(tint).toBeVisible();
      expect((await tint.boundingBox())!.height).toBe(32);
      await page.screenshot({ path: testInfo.outputPath(`compact-appearance-pressed-${appearance}.png`) });
      await page.mouse.up();
    };
    await capturePressTint('Dark', 'light');
    await expect.poll(readAppearance).toBe('dark');
    await page.waitForTimeout(300);
    await page.screenshot({ path: testInfo.outputPath('compact-appearance-dark.png') });
    await capturePressTint('Light', 'dark');
    await expect.poll(readAppearance).toBe('light');
  });

  test('keeps a new workout type as a draft until Save', async ({ page }) => {
    await openWorkoutTypes(page);
    await expect(page.getByText('New type', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Add workout type' }).click();
    await expect(page.getByText('New workout type', { exact: true })).toBeVisible();
    const titleBox = await page.getByTestId('new-workout-type-title-wrap').boundingBox();
    const saveBox = await page.getByRole('button', { name: 'Save workout type' }).boundingBox();
    expect(titleBox).not.toBeNull();
    expect(saveBox).not.toBeNull();
    expect((titleBox?.x ?? 0) + (titleBox?.width ?? 0)).toBeLessThanOrEqual(saveBox?.x ?? 0);
    await page.getByRole('button', { name: 'Cancel new workout type' }).click();
    await expect(page.getByText('New type', { exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'Add workout type' }).click();
    await page.getByLabel('Workout type name').fill('   ');
    await expect(page.getByRole('button', { name: 'Save workout type' })).toBeDisabled();
    await expect(page.getByText('New workout type', { exact: true })).toBeVisible();
    await page.getByLabel('Workout type name').fill('Recovery');
    await page.getByRole('button', { name: 'Workout type color', exact: true }).click();
    await expect(page.getByTestId('custom-workout-type-color-picker')).toBeVisible();
    await page.getByLabel('Color saturation and brightness').click({ position: { x: 90, y: 70 } });
    await page.getByRole('button', { name: /^Apply color #/ }).click();
    await expect(page.getByTestId('custom-workout-type-color-picker')).toHaveCount(0);
    await page.getByRole('button', { name: 'Save workout type' }).click();
    await expect(page.getByRole('button', { name: 'Recovery workout type' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Recovery workout type' })).toHaveCount(1);
  });

  test('guards a changed workout type draft on Cancel', async ({ page }) => {
    await openWorkoutTypes(page);
    await page.getByRole('button', { name: 'Add workout type' }).click();
    await page.getByLabel('Workout type name').fill('Recovery');
    await page.getByRole('button', { name: 'Cancel new workout type' }).click();
    const confirmation = page.getByTestId('discard-workout-type-confirmation');
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: 'Keep editing' }).click();
    await expect(confirmation).toBeHidden();
    await expect(page.getByText('New workout type', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel new workout type' }).click();
    await confirmation.getByRole('button', { name: 'Discard type' }).click();
    await expect(page.getByTestId('settings-detail-title')).toHaveText('Workout types');
  });
});
