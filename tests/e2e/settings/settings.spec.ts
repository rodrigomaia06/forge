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

  test('shows grouped settings and opens each destination', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();

    await expect(page.getByTestId('settings-title')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Muscle heatmap' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Exercises' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Workout types' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Measurements' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'General' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Backup & Export' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Logs' })).toBeVisible();
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
    await expect(page.getByRole('button', { name: 'Strength, 265 exercises' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mobility, 156 exercises' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cardio, 51 exercises' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Court sport, 13 exercises' })).toBeVisible();
    await page.getByRole('button', { name: 'Strength, 265 exercises' }).click();
    await expect(page.getByTestId('settings-detail-title').last()).toHaveText('Strength');
    await page.getByRole('button', { name: 'Back to Exercises' }).click();
    await page.getByRole('button', { name: 'Back to Settings' }).click();
    await expect(page.getByTestId('settings-title')).toBeVisible();

    await page.getByRole('button', { name: 'Workout types' }).click();
    await expect(page.getByTestId('settings-detail-title')).toHaveText('Workout types');
    await page.getByRole('button', { name: 'Strength workout type' }).click();
    await expect(
      page.getByRole('switch', { name: 'Hide Strength in workout pickers' }),
    ).toBeVisible();
    await expect(page.getByTestId('workout-type-visibility-bottom-divider')).toBeVisible();
    await page.getByRole('button', { name: 'Back to Settings' }).click();

    await page.getByRole('button', { name: 'Backup & Export' }).click();
    await expect(page.getByTestId('settings-detail-title')).toHaveText('Backup & Export');
    await expect(page.getByTestId('json-import-info-placeholder')).toBeVisible();
    await page.getByRole('button', { name: 'Back to Settings' }).click();

    await page.getByRole('button', { name: 'Logs' }).click();
    await expect(page.getByTestId('settings-detail-title')).toHaveText('Logs');
    await page.getByRole('button', { name: 'Back to Settings' }).click();

    await page.getByRole('button', { name: 'About' }).click();
    await expect(page.getByTestId('settings-detail-title')).toHaveText('About');
  });

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
    await expect(page.getByText('TREND', { exact: true })).toBeVisible();
    // The swipe-to-delete hint only appears once editing is enabled.
    await page.getByRole('button', { name: 'Edit measurements' }).click();
    await expect(page.getByText('Tap to edit · swipe to delete')).toBeVisible();

    await page.reload();
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
    await expect(expansion).toHaveCSS('background-color', 'rgb(248, 248, 246)');
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
    await expectRowHeight(page.getByRole('button', { name: 'Export JSON' }), 56);
    await expectRowHeight(page.getByRole('button', { name: 'Create SQLite backup' }), 56);
    await expect(page.getByRole('button', { name: 'Delete all app data' })).toBeVisible();
    await expectFontSize(page.getByText('Export JSON', { exact: true }), 16);

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
    await page.getByRole('button', { name: 'Export JSON' }).click();
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

  test('validates JSON, lets the user select import data, then opens its review', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Backup & Export' }).click();
    const chooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Import JSON' }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles({
      name: 'forge-import.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({
        format: 'forge-data', version: 1, exportedAt: '2026-09-13T00:00:00.000Z',
        settings: { workoutTypes: [], dailyMeasurementDefinitions: [], dailyMeasurementEntries: [] },
        plans: {
          plans: [
            // Older/manual exports can omit empty child lists. Importing them must not
            // leave Plans with an undefined collection when it renders the routine row.
            { name: 'Plan A', createdAt: 0, updatedAt: 0, routines: [{ name: 'Routine A', type: 'Strength', createdAt: 0, updatedAt: 0 }, { name: 'Routine B', type: 'Strength', exercises: [], createdAt: 0, updatedAt: 0 }] },
            { name: 'Plan B', createdAt: 0, updatedAt: 0, routines: [{ name: 'Routine C', type: 'Strength', exercises: [], createdAt: 0, updatedAt: 0 }, { name: 'Routine D', type: 'Strength', exercises: [], createdAt: 0, updatedAt: 0 }] },
          ],
          standaloneRoutines: [{ name: 'Routine E', type: 'Strength', exercises: [], createdAt: 0, updatedAt: 0 }],
        },
        workouts: { activeWorkout: null, completedWorkouts: [] }, customExercises: [],
      })),
    });
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByText('Choose import data', { exact: true })).toBeVisible();
    await expect(sheet.getByRole('checkbox', { name: 'Remove Workouts' })).toBeChecked();
    await sheet.getByRole('checkbox', { name: 'Remove Workouts' }).click();
    await expect(sheet.getByRole('checkbox', { name: 'Include Workouts' })).not.toBeChecked();
    await sheet.getByRole('button', { name: 'Review selected data' }).click();
    await expect(sheet.getByText('Review import', { exact: true })).toBeVisible();
    await expect(sheet.getByText('2 plans · 5 routines · 0 on device')).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Import selected data' })).toBeVisible();
    await expect(sheet.getByText('Workouts', { exact: true })).toHaveCount(0);
    await sheet.getByRole('button', { name: 'Import selected data' }).click();
    const summary = page.getByTestId('data-merged-summary');
    await expect(summary).toBeVisible();
    await expect(summary).toContainText('7 plans and routines');
    await expect(summary).toContainText('stayed on device');
    if (testInfo.project.use.isMobile === true) {
      await page.waitForTimeout(250);
      await page.screenshot({ path: testInfo.outputPath('import-merged-summary-iphone.png') });
    }
    await summary.getByRole('button', { name: 'Done' }).click();
    await expect(summary).toBeHidden();
    await page.getByRole('tab', { name: 'Plans' }).click();
    await expect(page.getByText('Routine A', { exact: true })).toBeVisible();
  });

  test('uses a Forge decision card when data transfer cannot complete', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Backup & Export' }).click();
    const chooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Import JSON' }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles({
      name: 'not-forge.json',
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

    await page.getByRole('button', { name: 'Default rest time' }).click();
    const defaultRestMenu = page.getByTestId('default-rest-selection-menu');
    await expect(defaultRestMenu).toBeVisible();
    // The scrim may fade in, but the menu itself must never be transparent
    // during that entrance; otherwise underlying text shows through it.
    await page.waitForTimeout(80);
    await expect(defaultRestMenu).toHaveCSS('opacity', '1');
    const defaultRestList = page.getByTestId('default-rest-selection-list');
    await expect(defaultRestList).toHaveAttribute('role', 'radiogroup');
    await expect(page.getByRole('radio', { name: '01:30' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.getByRole('radio', { name: '02:00' }).click();
    await expect(page.getByTestId('default-rest-selection-menu')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Default rest time' })).toContainText('02:00');
    await page.getByRole('button', { name: 'Default rest time' }).click();
    await expect(page.getByRole('radio', { name: '02:00' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.getByRole('radio', { name: '02:00' }).click();

    await page.getByRole('switch', { name: 'Unfinished workout reminder' }).click();
    await page.getByRole('button', { name: 'Remind after' }).click();
    await expect(page.getByTestId('reminder-selection-menu')).toBeVisible();
    const reminderList = page.getByTestId('reminder-selection-list');
    await expect(reminderList).toHaveAttribute('role', 'radiogroup');
    await page.getByRole('radio', { name: '1 hour' }).click();
    await expect(page.getByTestId('reminder-selection-menu')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Remind after' })).toContainText('1 hour');

    // Appearance is an inline segmented switcher (System / Light / Dark).
    const readAppearance = () =>
      page.evaluate(() => JSON.parse(localStorage.getItem('@forge/settings-preferences') ?? '{}').appearance);
    await expect(page.getByRole('radiogroup', { name: 'Appearance' })).toBeVisible();
    await page.getByRole('radio', { name: 'Light' }).click();
    await expect.poll(readAppearance).toBe('light');
    await page.getByRole('radio', { name: 'Dark' }).click();
    await expect.poll(readAppearance).toBe('dark');
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
    await page.getByRole('button', { name: 'Choose custom workout type color' }).click();
    await expect(page.getByTestId('custom-workout-type-color-picker')).toBeVisible();
    await page
      .getByRole('button', { name: /Use custom color #/ })
      .first()
      .click();
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
