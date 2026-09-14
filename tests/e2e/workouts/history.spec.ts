import { expect, test } from '@playwright/test';

const today = new Date();
const todayAtSixPmUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 18);
const daysAgo = (days: number): number => todayAtSixPmUtc - days * 24 * 60 * 60 * 1000;

const completedWorkouts = [
  makeWorkout('empty-session', 'Recovery walk', 'Mobility', daysAgo(2), 20, 0, 0),
  makeWorkout('muay-thai', 'Muay Thai', 'Martial arts', daysAgo(3), 72, 3, 8),
  makeWorkout('pull-25', 'Pull - Extension', 'Strength', daysAgo(4), 120, 7, 16),
  makeWorkout('push-20', 'Push - Shoulder', 'Strength', daysAgo(8), 84, 4, 12),
  makeWorkout('push-16', 'Push - Chest', 'Strength', daysAgo(12), 92, 6, 16),
  makeWorkout('pull-11', 'Pull - Extension', 'Strength', daysAgo(17), 4, 4, 10),
];

test.describe('History screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((workouts) => {
      if (sessionStorage.getItem('@forge/history-seeded')) return;
      localStorage.setItem('@forge/active-workout', 'null');
      localStorage.setItem('@forge/completed-workouts', JSON.stringify(workouts));
      sessionStorage.setItem('@forge/history-seeded', 'true');
    }, completedWorkouts);
    await page.goto('/');
    await page.getByRole('tab', { name: 'History' }).click();
  });

  test('groups completed sessions with one continuous timeline across periods', async ({ page }, testInfo) => {
    await expect(page.getByText('History', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Filter' })).toBeVisible();
    await expect(page.getByTestId('history-header')).toHaveCSS(
      'background-color',
      'rgb(232, 232, 232)',
    );
    await expect(page.getByText('Last week', { exact: true })).toBeVisible();
    await expect(page.getByText('2 weeks ago', { exact: true })).toBeVisible();
    await expect(page.getByText('Muay Thai', { exact: true }).last()).toBeVisible();
    await expect(page.getByText('Martial arts', { exact: true })).toBeVisible();
    await expect(page.getByText('3 exercises, 8 sets', { exact: true })).toBeVisible();
    await expect(page.getByText('7 exercises, 16 sets', { exact: true })).toBeVisible();
    await expect(page.getByText('1:12h', { exact: true })).toBeVisible();
    const typeIcon = await page.getByTestId('history-type-icon-empty-session').boundingBox();
    expect(typeIcon?.width).toBeCloseTo(44, 0);
    const [detailedCard, compactCard] = await Promise.all([
      page.getByTestId('history-card-muay-thai').boundingBox(),
      page.getByTestId('history-card-empty-session').boundingBox(),
    ]);
    expect(detailedCard?.height).toBeCloseTo(70, 0);
    expect(compactCard?.height).toBeCloseTo(60, 0);
    await expect(page.getByTestId(/^history-period-connector-/)).toHaveCount(2);
    const railCenters = await page
      .getByTestId(/^(history-marker-|history-period-connector-)/)
      .evaluateAll((elements) => elements.map((element) => {
        const box = element.getBoundingClientRect();
        return box.left + box.width / 2;
      }));
    expect(railCenters.length).toBeGreaterThan(2);
    railCenters.forEach((center) => expect(center).toBeCloseTo(railCenters[0], 0));
    const bridgeGradients = page.locator('linearGradient[id^="history-period-rail-"]');
    await expect(bridgeGradients).toHaveCount(2);
    await expect(bridgeGradients.first().locator('stop').nth(2)).toHaveAttribute('stop-opacity', '0.08');
    expect(await page.locator('svg').count()).toBeGreaterThan(0);
    if (testInfo.project.name === 'iphone-air') {
      await page.waitForTimeout(250);
      await page.screenshot({ path: testInfo.outputPath('history-continuous-timeline-iphone.png') });
    }
  });

  test('labels imported plan workouts with their plan and routine source', async ({ page }) => {
    const sourceWorkout = {
      ...completedWorkouts[0],
      id: 'imported-plan-workout',
      name: 'Chest',
      planId: 'plan-push',
      routineId: 'routine-chest',
    };
    await page.evaluate(({ workout }) => {
      localStorage.setItem('@forge/completed-workouts', JSON.stringify([workout]));
      localStorage.setItem('@forge/plans-v1', JSON.stringify({
        plans: [{
          id: 'plan-push',
          name: 'Push',
          createdAt: 1,
          updatedAt: 1,
          routines: [{
            id: 'routine-chest',
            name: 'Chest',
            type: 'Strength',
            exercises: [],
            planId: 'plan-push',
            createdAt: 1,
            updatedAt: 1,
          }],
        }],
        standaloneRoutines: [],
      }));
    }, { workout: sourceWorkout });
    // The web test server serves the Expo entrypoint only at `/`; navigating
    // there remounts providers without asking the static server for `/History`.
    await page.goto('/');
    await page.getByRole('tab', { name: 'History' }).click();
    const historyCard = page.getByTestId('history-card-imported-plan-workout');
    await expect(historyCard.getByText('Push - Chest', { exact: true })).toBeVisible();
  });

  test('filters History through the staged Forge workout-type flow', async ({ page }, testInfo) => {
    const headerFilter = page.getByTestId('history-header').getByRole('button', { name: 'Filter' });
    await headerFilter.click();
    const filterSheet = page.getByTestId('history-filter-sheet');
    await expect(filterSheet).toBeVisible();
    await expect(filterSheet.getByText('Filter history', { exact: true })).toBeVisible();
    if (testInfo.project.name === 'iphone-air') {
      await page.waitForTimeout(250);
      await page.screenshot({ path: testInfo.outputPath('history-filter-sheet-iphone.png') });
    }
    await filterSheet.getByRole('button', { name: 'Edit Workout type filter, Any' }).click();
    await expect(filterSheet.getByText('Workout type', { exact: true })).toBeVisible();
    await filterSheet.getByRole('checkbox', { name: 'Filter Workout type: Strength' }).click();
    await filterSheet.getByRole('button', { name: 'Back to filters' }).click();
    await expect(filterSheet.getByRole('button', { name: 'Edit Workout type filter, Strength' })).toBeVisible();
    await filterSheet.getByRole('button', { name: 'Apply (1)' }).click();

    await expect(page.getByRole('button', { name: 'Open Pull - Extension' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open Muay Thai' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Open Recovery walk' })).toHaveCount(0);

    await headerFilter.click();
    await filterSheet.getByRole('button', { name: 'Clear filters' }).click();
    await filterSheet.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.getByRole('button', { name: 'Open Muay Thai' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open Recovery walk' })).toBeVisible();
  });

  test('keeps the old Forge month and explicit-date modes in the staged filter', async ({ page }) => {
    const headerFilter = page.getByTestId('history-header').getByRole('button', { name: 'Filter' });
    await headerFilter.click();
    const filterSheet = page.getByTestId('history-filter-sheet');

    await filterSheet.getByRole('button', { name: 'Edit Date range filter, All dates' }).click();
    await expect(filterSheet.getByRole('radio', { name: 'All dates' })).toBeVisible();
    await filterSheet.getByRole('radio', { name: 'Month' }).click();
    await expect(filterSheet.getByTestId('history-filter-month')).toBeVisible();
    await filterSheet.getByRole('button', { name: 'Previous filter month' }).click();
    await filterSheet.getByRole('button', { name: 'Back to filters' }).click();
    await expect(filterSheet.getByRole('button', { name: /Edit Date range filter, [A-Z][a-z]{2} \d{4}/ })).toBeVisible();

    await filterSheet.getByRole('button', { name: /Edit Date range filter/ }).click();
    await filterSheet.getByRole('radio', { name: 'Custom dates' }).click();
    await filterSheet.getByRole('button', { name: /Edit From filter/ }).click();
    const fromPicker = filterSheet.getByTestId('history-filter-from-picker');
    await fromPicker.getByRole('button', { name: /^Select / }).first().click();
    await filterSheet.getByRole('button', { name: 'Back to date range' }).click();
    await expect(filterSheet.getByRole('button', { name: /Edit To filter/ })).toBeVisible();
    await filterSheet.getByRole('button', { name: 'Back to filters' }).click();
    await expect(filterSheet.getByRole('button', { name: /Edit Date range filter, .+ to .+/ })).toBeVisible();
  });

  test('uses a filled, borderless History filter control in dark mode', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance: 'dark' }));
    });
    await page.goto('/');
    await page.getByRole('tab', { name: 'History' }).click();

    const filter = page.getByRole('button', { name: 'Filter' });
    await expect(filter).toHaveCSS('border-width', '0px');
    await expect(filter).toHaveCSS('background-color', 'rgb(48, 54, 59)');
  });

  test('omits the exercise summary when a completed workout has no exercises or sets', async ({
    page,
  }) => {
    const card = page.getByTestId('history-timeline-empty-session');
    await expect(card.getByRole('button', { name: 'Open Recovery walk' })).toContainText('Recovery walk');
    await expect(card.getByText(/exercises.*sets/)).toHaveCount(0);
    const [compactCard, detailedCard] = await Promise.all([
      card.getByRole('button', { name: 'Open Recovery walk' }).boundingBox(),
      page.getByRole('button', { name: 'Open Muay Thai' }).boundingBox(),
    ]);
    // The compact card keeps a smaller scan target than a card that includes
    // exercise metadata. Do not couple the check to browser rounding around
    // the 44pt icon and card border.
    expect(compactCard?.height ?? Infinity).toBeLessThan(detailedCard?.height ?? 0);
    expect(compactCard?.height ?? 0).toBeGreaterThanOrEqual(64);
  });

  test('keeps History cards at the full available row width', async ({ page }) => {
    const card = await page.getByRole('button', { name: 'Open Muay Thai' }).boundingBox();
    const viewportWidth = page.viewportSize()?.width;
    if (!card || !viewportWidth) throw new Error('Expected the History card and viewport to be measurable');
    expect(card.x + card.width).toBeGreaterThanOrEqual(viewportWidth - 17);
  });

  test('keeps history groups in descending order', async ({ page }) => {
    const headings = await page.locator('[data-testid^="history-group-"]').allTextContents();
    expect(headings[0]).toContain('Muay Thai');
    expect(headings.at(-1)).toContain('Pull - Extension');
  });

  test('opens an individual workout with a structured summary and no rest timer', async ({ page }) => {
    await page.getByRole('button', { name: 'Open Muay Thai' }).click();

    const summary = page.getByTestId('workout-details-summary');
    await expect(summary).toContainText('3 exercises, 8 sets');
    await expect(page.getByText('Muay Thai', { exact: true }).last()).toBeVisible();
    await expect(summary).toContainText('1:12h');
    await expect(summary).toContainText('Duration');
    await expect(summary).toContainText('Not recorded');
    await expect(page.getByText('Rest', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Back to History' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to History' })).not.toContainText('Back');
    await expect(page.getByRole('button', { name: 'Workout options' })).toContainText('More');

    await expect(page.getByText('Exercise 1', { exact: true })).toBeVisible();
  });

  test('keeps workout context compact until Session details is requested', async ({ page }, testInfo) => {
    const workout = {
      ...completedWorkouts.find((item) => item.id === 'muay-thai')!,
      note: 'Felt strong overall. Increased the working weight.',
      averageRestSeconds: 102,
      attributes: { Location: 'Forge Gym', Energy: 'High', Goal: 'Strength', Sleep: '8 hours' },
      attributeIcons: { Location: 'location', Energy: 'energy', Goal: 'goal', Sleep: 'sleep' },
    };
    await page.evaluate((nextWorkout) => {
      localStorage.setItem('@forge/completed-workouts', JSON.stringify([nextWorkout]));
    }, workout);
    await page.goto('/');
    await page.getByRole('tab', { name: 'History' }).click();
    await page.getByRole('button', { name: 'Open Muay Thai' }).click();

    const summary = page.getByTestId('workout-details-summary');
    await expect(summary.getByText('1m 42s', { exact: true })).toBeVisible();
    await expect(summary.getByText('Felt strong overall. Increased the working weight.', { exact: true })).toBeVisible();
    const details = summary.getByRole('button', { name: 'Show session details' });
    await expect(details).toContainText('Location, Energy, Goal +1');
    await expect(summary.getByText('Forge Gym', { exact: true })).toHaveCount(0);
    await details.click();
    await expect(summary.getByRole('button', { name: 'Hide session details' })).toBeVisible();
    await expect(summary.getByText('Forge Gym', { exact: true })).toBeVisible();
    await expect(summary.getByText('8 hours', { exact: true })).toBeVisible();
    if (testInfo.project.name === 'iphone-air') {
      await page.screenshot({ path: testInfo.outputPath('workout-summary-card-iphone.png') });
    }
  });

  test('returns to History through the Back action after opening a workout', async ({ page }) => {
    await page.getByRole('button', { name: 'Open Muay Thai' }).click();
    await page.getByRole('button', { name: 'Back to History' }).click();
    await expect(page.getByTestId('history-header')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open Muay Thai' })).toBeVisible();
  });

  test('uses the shared 15px action label for the visible workout-header action', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Open Muay Thai' }).click();
    const metrics = await page.getByText('More', { exact: true }).evaluate((element) => {
      const style = window.getComputedStyle(element);
      return { fontSize: style.fontSize, lineHeight: style.lineHeight };
    });
    expect(metrics).toEqual({ fontSize: '15px', lineHeight: '20px' });
  });

  test('opens functional workout options and can delete the selected workout', async ({ page }) => {
    await page.getByRole('button', { name: 'Open Muay Thai' }).click();
    await page.getByRole('button', { name: 'Workout options' }).click();
    await expect(page.getByText('Workout options', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Delete Muay Thai' }).locator('svg'),
    ).toHaveCount(1);
    await page.getByRole('button', { name: 'Delete Muay Thai' }).click();
    await expect(page.getByTestId('history-header')).toBeVisible();
    await expect(page.getByText('Muay Thai', { exact: true })).toHaveCount(0);
  });

  test('edits a completed workout and persists the saved session', async ({ page }) => {
    await page.getByRole('button', { name: 'Open Muay Thai' }).click();
    await page.getByRole('button', { name: 'Workout options' }).click();
    await page.getByRole('button', { name: 'Edit workout' }).click();
    await expect(page.getByLabel('Workout name')).toBeVisible();
    const workoutName = page.getByLabel('Workout name');
    await workoutName.click();
    await workoutName.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await workoutName.pressSequentially('Edited Muay Thai');
    await expect(page.getByLabel('Workout name')).toHaveValue('Edited Muay Thai');
    await page.getByRole('button', { name: 'Choose workout type' }).click();
    await expect(page.getByRole('radio', { name: 'Strength' })).toBeVisible();
    await page.getByRole('radio', { name: 'Cardio' }).click();
    await expect(page.getByRole('button', { name: 'Choose workout type' })).toContainText('Cardio');
    await page.getByRole('button', { name: 'Select Date' }).click();
    const datePicker = page.getByTestId('history-date-picker');
    await expect(datePicker).toBeVisible();
    await datePicker.getByRole('button', { name: 'Next month' }).click();
    await datePicker.getByRole('button', { name: /^Select / }).first().click();
    await page.getByRole('button', { name: 'Back to edit workout' }).click();
    await page.getByRole('button', { name: 'Select Start time' }).click();
    const startTimePicker = page.getByTestId('history-start-picker');
    await expect(startTimePicker).toBeVisible();
    await startTimePicker.getByRole('radio', { name: 'Hours 17' }).click();
    await page.getByRole('button', { name: 'Save selected date and time' }).click();
    await page.getByRole('button', { name: 'Select End time' }).click();
    const endTimePicker = page.getByTestId('history-end-picker');
    await expect(endTimePicker).toBeVisible();
    await endTimePicker.getByRole('radio', { name: 'Hours 19' }).click();
    await page.getByRole('button', { name: 'Save selected date and time' }).click();
    await page.getByRole('button', { name: 'Add attribute' }).click();
    await page.getByLabel('Attribute label').fill('Location');
    await page.getByLabel('Attribute value').fill('Forge Gym');
    await page.getByRole('button', { name: 'Choose attribute icon' }).click();
    await page.getByRole('radio', { name: 'Use location icon' }).click();
    await page.getByRole('button', { name: 'Save attribute' }).click();
    await page.getByRole('button', { name: 'Edit Location attribute' }).click();
    await page.getByRole('button', { name: 'Remove attribute' }).click();
    await expect(page.getByRole('button', { name: 'Edit Location attribute' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Add attribute' }).click();
    await page.getByLabel('Attribute label').fill('Location');
    await page.getByLabel('Attribute value').fill('Forge Gym');
    await page.getByRole('button', { name: 'Save attribute' }).click();
    await page.getByLabel('Notes').fill('Updated session');
    await page.getByRole('button', { name: 'Save workout' }).click();
    await expect(page.getByTestId('history-header')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open Edited Muay Thai' })).toBeVisible();
    // The static Expo test server serves the entrypoint at `/` only. Loading
    // it explicitly remounts providers and verifies persisted state without
    // asking the static server to resolve the nested History URL.
    await page.goto('/');
    await page.getByRole('tab', { name: 'History' }).click();
    await expect(page.getByRole('button', { name: 'Open Edited Muay Thai' })).toBeVisible();
  });

  test('uses the Forge card before discarding changed historical edits', async ({ page }) => {
    await page.getByRole('button', { name: 'Open Muay Thai' }).click();
    await page.getByRole('button', { name: 'Workout options' }).click();
    await page.getByRole('button', { name: 'Edit workout' }).click();
    const workoutName = page.getByLabel('Workout name');
    await workoutName.click();
    await workoutName.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await workoutName.pressSequentially('Unsaved Muay Thai');
    await expect(page.getByLabel('Workout name')).toHaveValue('Unsaved Muay Thai');
    await page.getByRole('button', { name: 'Cancel editing workout' }).click();

    const confirmation = page.getByTestId('discard-history-workout-confirmation');
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: 'Keep editing' }).click();
    await expect(page.getByLabel('Workout name')).toHaveValue('Unsaved Muay Thai');
    await page.getByRole('button', { name: 'Cancel editing workout' }).click();
    await confirmation.getByRole('button', { name: 'Discard changes' }).click();
    await expect(page.getByTestId('history-header')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open Muay Thai' })).toBeVisible();
  });

  test('does not open a workout after swiping its History card', async ({ page }) => {
    const card = page.getByTestId('history-swipe-muay-thai');
    const box = await card.boundingBox();
    if (!box) throw new Error('Expected History card to be measurable');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x - 90, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    const deleteAction = page.getByRole('button', { name: 'Delete Muay Thai' });
    await expect(deleteAction).toBeVisible();
    const [surfaceBox, deleteBox] = await Promise.all([
      page.getByTestId('history-card-muay-thai').boundingBox(),
      deleteAction.boundingBox(),
    ]);
    expect(
      (surfaceBox?.x ?? 0) + (surfaceBox?.width ?? 0) - (deleteBox?.x ?? 0),
    ).toBeCloseTo(0, 0);
    await expect(page.getByTestId('history-card-muay-thai')).toHaveCSS(
      'border-top-right-radius',
      '16px',
    );
    await expect(page.getByTestId('history-header')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to History' })).toHaveCount(0);
  });

  test('keeps workout details read-only and expands exercises individually', async ({ page }, testInfo) => {
    await page.getByRole('button', { name: 'Open Muay Thai' }).click();
    await expect(
      page.getByTestId('workout-details-summary').getByText('Exercises', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Volume', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Calories', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Expand Exercise 1' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await page.getByRole('button', { name: 'Expand Exercise 1' }).click();
    await expect(page.getByRole('button', { name: 'Collapse Exercise 1' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expect(page.getByTestId('workout-details-set-muay-thai-set-0-0')).toContainText('60');
    await expect(page.getByTestId('workout-details-set-completion-muay-thai-set-0-0')).toHaveCSS(
      'background-color',
      'rgb(77, 123, 103)',
    );
    await expect(
      page.getByTestId('workout-details-set-completion-muay-thai-set-0-1'),
    ).not.toHaveCSS('background-color', 'rgb(98, 201, 138)');
    const firstSet = page.getByTestId('workout-details-set-muay-thai-set-0-0');
    await expect(firstSet).not.toContainText('History note');
    await expect(firstSet.getByLabel('Set 1 has a comment')).toBeVisible();
    const historyExercise = page.getByTestId('history-exercise-muay-thai-exercise-0');
    await expect(historyExercise).not.toContainText('Exercise history note');
    await expect(historyExercise.locator('svg[aria-label="Exercise has a comment"]')).toBeVisible();
    const [chipBox, dotBox, targetDotBox, rpeBox] = await Promise.all([
      page.getByTestId('history-set-number-chip-1').boundingBox(),
      firstSet.getByLabel('Set 1 has a comment').boundingBox(),
      firstSet.getByLabel('Set 1 has a next session target').boundingBox(),
      firstSet.getByLabel('Set 1 RPE 8').boundingBox(),
    ]);
    expect(chipBox).not.toBeNull();
    expect(dotBox).not.toBeNull();
    expect(targetDotBox).not.toBeNull();
    expect(rpeBox).not.toBeNull();
    if (!chipBox || !dotBox || !targetDotBox || !rpeBox) throw new Error('Expected measurable history set indicators');
    await expect(firstSet.getByLabel('Set 1 has a comment').locator('svg')).toHaveCount(0);
    expect(dotBox.width).toBeCloseTo(7, 0);
    expect(dotBox.height).toBeCloseTo(7, 0);
    expect(dotBox.x).toBeGreaterThan(chipBox.x + chipBox.width / 2);
    expect(dotBox.y).toBeGreaterThan(chipBox.y + chipBox.height / 2);
    expect(dotBox.x).toBeLessThan(chipBox.x + chipBox.width);
    expect(dotBox.y).toBeLessThan(chipBox.y + chipBox.height);
    expect(dotBox.x + dotBox.width).toBeLessThanOrEqual(chipBox.x + chipBox.width);
    expect(dotBox.y + dotBox.height).toBeLessThanOrEqual(chipBox.y + chipBox.height);
    expect(dotBox.x + dotBox.width).toBeGreaterThan(chipBox.x + chipBox.width - 3);
    expect(dotBox.y + dotBox.height).toBeGreaterThan(chipBox.y + chipBox.height - 3);
    await expect(firstSet.getByLabel('Set 1 has a next session target')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    expect(targetDotBox.x).toBeLessThan(chipBox.x + chipBox.width / 2);
    expect(targetDotBox.y).toBeLessThan(chipBox.y + chipBox.height / 2);
    expect(rpeBox.x).toBeLessThan(chipBox.x + chipBox.width / 2);
    expect(rpeBox.y + rpeBox.height).toBeGreaterThan(chipBox.y + chipBox.height / 2);
    if (testInfo.project.name === 'iphone-air') {
      await page.screenshot({ path: testInfo.outputPath('commented-history-exercise-iphone.png') });
    }
    // Targets remain discoverable through the marker and Set details, rather
    // than adding a second property line below the row.
    await expect(firstSet).not.toContainText('Next time');
    await expect(page.getByLabel('Workout options')).toBeVisible();
    await page.getByRole('button', { name: 'Open details for set 1' }).click();
    const sheet = page.getByTestId('set-details-sheet');
    await expect(sheet.getByText('Set 1', { exact: true })).toBeVisible();
    await expect(sheet.getByText('History note', { exact: true })).toBeVisible();
    await expect(sheet.getByText('No type recorded', { exact: true })).toBeVisible();
    await expect(sheet.getByText('SET KIND', { exact: true })).toBeVisible();
    await expect(sheet.getByText('SESSION NOTE & EFFORT', { exact: true })).toBeVisible();
    await expect(sheet.getByText('NEXT SESSION', { exact: true })).toBeVisible();
    await expect(sheet.getByRole('radio')).toHaveCount(0);
    await expect(sheet.getByRole('button', { name: 'Change set kind' })).toHaveCount(0);
    await expect(sheet.getByRole('button', { name: 'Delete Set 1' })).toHaveCount(0);
    await expect(page.getByLabel('Comment for set 1')).toHaveCount(0);
    if (testInfo.project.name === 'iphone-air') {
      await page.waitForTimeout(250);
      await page.screenshot({ path: testInfo.outputPath('history-set-editor-iphone.png') });
    }
  });

  test('keeps the empty state available without completed sessions', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('@forge/completed-workouts', '[]');
    });
    await page.reload();
    await page.getByRole('tab', { name: 'History' }).click();
    await expect(page.getByTestId('history-empty-illustration')).toBeVisible();
    await expect(page.getByText('No completed workouts', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start a workout' })).toBeVisible();
  });

  test('keeps collapsed History exercise cards compact with the set count beside the name', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Open Muay Thai' }).click();
    const exercise = page.getByTestId('history-exercise-muay-thai-exercise-0');
    await expect(exercise).toContainText('Exercise 1');
    await expect(exercise).toContainText('3 sets');
    await expect(exercise).not.toContainText('· 3 sets');
    const box = await exercise.boundingBox();
    expect(box?.height).toBeLessThanOrEqual(58);
  });
});

function makeWorkout(
  id: string,
  name: string,
  type: string,
  completedAt: number,
  durationMinutes: number,
  exerciseCount: number,
  setCount: number,
) {
  return {
    id,
    name,
    type,
    startedAt: completedAt - durationMinutes * 60 * 1000,
    completedAt,
    durationSeconds: durationMinutes * 60,
    exercises: Array.from({ length: exerciseCount }, (_, exerciseIndex) => ({
      id: `${id}-exercise-${exerciseIndex}`,
      name: `Exercise ${exerciseIndex + 1}`,
      note: exerciseIndex === 0 ? 'Exercise history note' : undefined,
      sets: Array.from(
        {
          length:
            Math.floor(setCount / exerciseCount) +
            (exerciseIndex < setCount % exerciseCount ? 1 : 0),
        },
        (_, setIndex) => ({
          id: `${id}-set-${exerciseIndex}-${setIndex}`,
          weight: '60',
          reps: '8',
          completed: !(id === 'muay-thai' && exerciseIndex === 0 && setIndex === 1),
          comment: exerciseIndex === 0 && setIndex === 0 ? 'History note' : undefined,
          targetWeight: exerciseIndex === 0 && setIndex === 0 ? '65' : undefined,
          measurements: exerciseIndex === 0 && setIndex === 0
            ? [{ id: `${id}-rpe-${exerciseIndex}-${setIndex}`, kind: 'rpe', unit: 'rpe', value: 8 }]
            : undefined,
        }),
      ),
    })),
  };
}
