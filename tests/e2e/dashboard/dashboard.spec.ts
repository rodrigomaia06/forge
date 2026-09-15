import { expect, test, type Page } from '@playwright/test';

test.describe('Dashboard', () => {
  test('matches the iPhone visual baseline', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone-air', 'The baseline is intentionally iPhone-specific.');
    await page.goto('/');

    await expect(page.getByTestId('dashboard-header-title')).toBeVisible();
    await expect(page).toHaveScreenshot('dashboard.png', {
      fullPage: true,
      mask: [page.getByTestId('dashboard-header-title')],
    });
  });

  test('switches calendar scale from the overflow menu and selects a workout day', async ({
    page,
  }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Change calendar view' }).click();
    await expect(page.getByRole('menuitem', { name: 'Week' })).toBeVisible();
    await page.mouse.click(40, 500);
    await expect(page.getByRole('menuitem', { name: 'Week' })).toBeHidden();
    await page.getByRole('button', { name: 'Change calendar view' }).click();
    await page.getByRole('menuitem', { name: 'Week' }).click();
    await expect(page.getByText('Week of August 24')).toBeVisible();

    await page.getByRole('button', { name: /24 August 2026/ }).click();
    await expect(page.getByTestId('calendar-selected-day')).toBeVisible();
  });

  test('opens a local historical-workout draft for the selected empty calendar date', async ({ page }) => {
    await page.goto('/');

    const addHistoricalWorkout = page.getByRole('button', { name: 'Add historical workout' });
    await expect(addHistoricalWorkout).toBeVisible();
    await addHistoricalWorkout.click();
    const sourceChooser = page.getByTestId('historical-workout-source-chooser');
    await expect(sourceChooser).toBeVisible();
    // Both mandatory choices are composed with the sheet from its entrance,
    // rather than joining after the sheet is already moving.
    await expect(sourceChooser.getByRole('button', { name: 'Blank workout' })).toBeVisible();
    await expect(sourceChooser.getByRole('button', { name: 'From routine' })).toBeVisible();
    await sourceChooser.getByRole('button', { name: 'Blank workout' }).click();
    await expect(page.getByLabel('Workout name')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Select Date' })).toContainText('2026-08-24');
    await expect(page.getByRole('button', { name: 'Select Start time' })).toContainText('Choose time');
    await expect(page.getByRole('button', { name: 'Select End time' })).toContainText('Choose time');
    await expect(page.getByRole('button', { name: 'Save workout' })).toBeDisabled();

    await page.getByRole('button', { name: 'Cancel editing workout' }).click();
    await expect(addHistoricalWorkout).toBeVisible();
  });

  test('saves a historical workout on its selected calendar date', async ({ page }, testInfo) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Add historical workout' }).click();
    await page.getByRole('button', { name: 'Blank workout' }).click();
    await page.getByLabel('Workout name').fill('Calendar workout');
    await page.getByRole('button', { name: 'Select Start time' }).click();
    await page.getByTestId('history-start-picker').getByRole('radio', { name: 'Hours 16' }).click();
    await page.getByRole('button', { name: 'Back to edit workout' }).click();
    await expect(page.getByRole('button', { name: 'Select Start time' })).toContainText('Choose time');
    await page.getByRole('button', { name: 'Select Start time' }).click();
    await page.getByTestId('history-start-picker').getByRole('radio', { name: 'Hours 17' }).click();
    await page.getByRole('button', { name: 'Save selected date and time' }).click();
    await page.getByRole('button', { name: 'Select End time' }).click();
    await page.getByTestId('history-end-picker').getByRole('radio', { name: 'Hours 16' }).click();
    await page.getByRole('button', { name: 'Save selected date and time' }).click();
    await expect(page.getByText('End time must be after the start time.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save workout' })).toBeDisabled();
    await page.getByRole('button', { name: 'Select End time' }).click();
    await page.getByTestId('history-end-picker').getByRole('radio', { name: 'Hours 19' }).click();
    await page.getByRole('button', { name: 'Save selected date and time' }).click();
    await expect(page.getByRole('button', { name: 'Save workout' })).toBeEnabled();
    await page.getByRole('button', { name: 'Save workout' }).click();

    await expect.poll(() => hasVisibleExactText(page, 'August 24, 2026')).toBe(true);
    await expect.poll(() => hasVisibleExactText(page, 'Calendar workout')).toBe(true);
    // Mobile Chromium emulation creates a fresh OPFS worker on reload, unlike
    // the native iOS target this visual profile represents. The desktop web
    // project exercises durable web-storage reload semantics below.
    if (testInfo.project.name === 'iphone-air') return;
    await page.reload();
    await expect.poll(() => hasVisibleExactText(page, 'Calendar workout')).toBe(true);
  });

  test('opens a recorded workout from its selected calendar day in History detail', async ({ page }) => {
    await page.addInitScript(() => {
      const completedAt = Date.UTC(2026, 7, 24, 18);
      localStorage.setItem('@forge/completed-workouts', JSON.stringify([{
        id: 'dashboard-day-workout',
        name: 'Dashboard day workout',
        type: 'Strength',
        startedAt: completedAt - 3600_000,
        completedAt,
        durationSeconds: 3600,
        exercises: [],
      }]));
    });
    await page.goto('/');

    await page.getByRole('button', { name: /Dashboard day workout, Strength/ }).click();
    await expect(page.getByTestId('workout-details-summary')).toBeVisible();
    await expect(page.getByText('Dashboard day workout', { exact: true }).last()).toBeVisible();
    await page.getByRole('button', { name: 'Back to History' }).click();
    await expect(page.getByTestId('history-header')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open Dashboard day workout' })).toBeVisible();
  });

  test('seeds a historical draft from an independent routine snapshot', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Plans' }).click();
    await page.getByRole('button', { name: 'Create workout, routine, or plan' }).click();
    await page.getByTestId('plans-creation-popover').getByRole('button', { name: 'New routine' }).click();
    await page.getByLabel('Routine name').fill('Template pull');
    await page.getByRole('button', { name: 'Add attribute' }).click();
    await page.getByLabel('Attribute label').fill('Readiness');
    await page.getByRole('button', { name: 'Choose attribute icon' }).click();
    await page.getByRole('radio', { name: 'Use focus icon' }).click();
    await page.getByRole('button', { name: 'Save attribute' }).click();
    // Compact iPhone web can recycle the header input after an attribute sheet closes.
    await page.getByLabel('Routine name').fill('Template pull');
    await page.getByRole('button', { name: 'Save routine' }).click();

    await page.getByRole('tab', { name: 'Dashboard' }).click();
    await page.getByRole('button', { name: 'Add historical workout' }).click();
    await page.getByRole('button', { name: 'From routine' }).click();
    await expect(page.getByText('Standalone routines', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Use Template pull routine' }).click();
    await expect(page.getByLabel('Workout name')).toHaveValue('Template pull');
    await expect(page.getByRole('button', { name: 'Edit Readiness attribute' })).toBeVisible();
    await page.getByRole('button', { name: 'Edit Readiness attribute' }).click();
    await expect(page.getByLabel('Attribute value')).toHaveValue('');
    await page.getByRole('button', { name: 'Choose attribute icon' }).click();
    await expect(page.getByTestId('attribute-icon-choice-focus-selected')).toBeVisible();
    await page.getByRole('button', { name: 'Choose attribute icon' }).click();
    await page.getByLabel('Attribute value').fill('Ready');
    await page.getByRole('button', { name: 'Save attribute' }).click();
    await expect(page.getByRole('button', { name: 'Edit Readiness attribute' })).toContainText('Ready');
  });

  test('requires a routine selection after choosing a plan source', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Plans' }).click();
    await page.getByRole('button', { name: 'Create workout, routine, or plan' }).click();
    await page.getByTestId('plans-creation-popover').getByRole('button', { name: 'New workout plan' }).click();
    await page.getByRole('button', { name: 'Add routine to New plan' }).click();
    await page.getByLabel('Routine name').fill('Planned pull');
    await page.getByRole('button', { name: 'Save routine' }).click();

    await page.getByRole('tab', { name: 'Dashboard' }).click();
    await page.getByRole('button', { name: 'Add historical workout' }).click();
    await page.getByRole('button', { name: 'From routine' }).click();
    await page.getByRole('button', { name: 'Choose routine from New plan' }).click();
    const plannedRoutine = page.getByRole('button', { name: 'Use Planned pull routine' });
    await expect(plannedRoutine).toBeVisible();
    await plannedRoutine.click();
    await expect(page.getByLabel('Workout name')).toHaveValue('New plan - Planned pull');
  });

  test('gives the dock priority while the calendar view menu is open', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Change calendar view' }).click();
    await expect(page.getByRole('menuitem', { name: 'Week' })).toBeVisible();

    await page.getByRole('tab', { name: 'History' }).click();

    await expect(page.getByText('History', { exact: true })).toBeVisible();
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
      expect(Math.abs(title.x - dashboardTitle.x)).toBeLessThanOrEqual(1);
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
      expect(Math.abs((activeIndicator.x + activeIndicator.width / 2) - (activeTab.x + activeTab.width / 2))).toBeLessThanOrEqual(1);
    }
    if (testInfo.project.name === 'iphone-air') await page.screenshot({ path: testInfo.outputPath('four-tab-selection-centred-iphone.png'), fullPage: true });
  });

  test('keeps the five-tab dock selection centred during an active workout', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Start workout' }).click();
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
      ).toBeLessThanOrEqual(1);
    }
    if (testInfo.project.name === 'iphone-air') {
      await page.screenshot({ path: testInfo.outputPath('five-tab-selection-centred-iphone.png'), fullPage: true });
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
    const selectedDate = page.getByText(/^August \d{1,2}, 2026$/);
    await expect(selectedDate).toBeVisible();
    expect(await readTextMetrics(page.getByTestId('dashboard-header-title'))).toEqual({
      fontSize: '31px',
      lineHeight: '36px',
    });
    expect(await readTextMetrics(selectedDate)).toEqual({
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

async function hasVisibleExactText(page: Page, text: string): Promise<boolean> {
  return page.getByText(text, { exact: true }).evaluateAll((elements) =>
    elements.some((element) => {
      const style = window.getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden';
    }),
  );
}
