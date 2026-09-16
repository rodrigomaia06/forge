import { expect, test, type Page } from '@playwright/test';

const completedWorkouts = [
  {
    id: 'capture-upper-push',
    name: 'Upper push',
    type: 'Strength',
    startedAt: Date.UTC(2026, 7, 24, 7, 22),
    completedAt: Date.UTC(2026, 7, 24, 8, 14),
    durationSeconds: 52 * 60,
    averageRestSeconds: 83,
    attributes: { Location: 'Gym', Mood: 'Great' },
    attributeIcons: { Location: 'location', Mood: 'mood' },
    note: 'Felt strong. Good pump.',
    exercises: [
      {
        id: 'capture-incline-press',
        name: 'Incline Smith Press',
        sets: [
          { id: 'capture-set-1', weight: '80', reps: '8', completed: true },
          { id: 'capture-set-2', weight: '90', reps: '6', completed: true },
        ],
      },
      {
        id: 'capture-dips',
        name: 'Dips',
        sets: [{ id: 'capture-set-3', weight: '12', reps: '10', completed: true }],
      },
    ],
  },
];

async function seedHistory(page: Page): Promise<void> {
  await page.addInitScript((workouts) => {
    localStorage.setItem('@forge/active-workout', 'null');
    localStorage.setItem('@forge/completed-workouts', JSON.stringify(workouts));
  }, completedWorkouts);
}

async function enableDark(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance: 'dark' }));
  });
}

async function capture(page: Page, name: string): Promise<void> {
  // Let short entrance/layout animations settle so captures show final UI, not an in-between frame.
  await page.waitForTimeout(250);
  await page.screenshot({ path: test.info().outputPath(`${name}.png`), fullPage: true });
}

test.describe('Forge screen captures', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.use.isMobile !== true, 'Product visual captures use the configured phone profiles.');
  });

  test('captures Dashboard, Plans and Settings', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('dashboard-header-title')).toBeVisible();
    await capture(page, 'dashboard');

    await page.getByRole('tab', { name: 'Plans' }).click();
    await expect(page.getByText('Plans', { exact: true })).toBeVisible();
    await capture(page, 'plans');
    await page.getByRole('button', { name: 'Create workout, routine, or plan' }).click();
    await expect(page.getByTestId('plans-creation-popover')).toBeVisible();
    await capture(page, 'plans-creation-popover');
    await page
      .getByTestId('plans-creation-popover')
      .getByRole('button', { name: 'New routine', exact: true })
      .click();
    await expect(page.getByLabel('Routine name')).toBeVisible();
    await capture(page, 'routine-editor');
    await page.getByRole('button', { name: 'Cancel editing routine' }).click();

    await page.getByRole('tab', { name: 'Settings' }).click();
    await expect(page.getByTestId('settings-title')).toBeVisible();
    await capture(page, 'settings');

    await page.getByRole('button', { name: 'General' }).click();
    await expect(page.getByText('Calendar', { exact: true })).toBeVisible();
    await capture(page, 'general-settings');
    await page.getByRole('button', { name: 'Appearance' }).click();
    await capture(page, 'general-appearance-picker');
    if ((page.viewportSize()?.width ?? 0) >= 768) {
      await page.getByRole('radio', { name: 'Light' }).click();
    } else {
      await page.getByRole('radio', { name: 'Light' }).click();
    }
    await page.getByRole('button', { name: 'Default rest time' }).click();
    await capture(page, 'general-default-rest-picker');
    await page.getByRole('radio', { name: '00:30' }).dispatchEvent('click');
    await page.getByRole('switch', { name: 'Unfinished workout reminder' }).click();
    await page.getByRole('button', { name: 'Remind after' }).click();
    await capture(page, 'general-reminder-picker');
    await page.getByRole('radio', { name: '15 minutes' }).dispatchEvent('click');

    await page.getByRole('button', { name: 'Back to Settings' }).click();
    await page.getByRole('button', { name: 'Exercises' }).click();
    await expect(page.getByTestId('settings-detail-title')).toHaveText('Exercises');
    await capture(page, 'settings-exercises');

    await page.getByRole('button', { name: 'All exercises, 381 exercises' }).click();
    await expect(page.getByTestId('settings-detail-title').last()).toHaveText('All exercises');
    await capture(page, 'settings-exercise-browser');
    await page.getByRole('button', { name: 'Filters' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await capture(page, 'settings-exercise-filter-sheet');

    await page.getByRole('button', { name: 'Cancel exercise filters' }).click();
    await page.getByRole('button', { name: 'Create custom exercise' }).click();
    await capture(page, 'settings-new-exercise-sheet');
    await page.getByRole('button', { name: 'Equipment' }).click();
    await capture(page, 'settings-new-exercise-equipment-selector');
    await page.getByRole('button', { name: 'Back to exercise form' }).click();
    await page.getByTestId('forge-sheet-drag-area').getByRole('button', { name: 'Close custom exercise form' }).click();
    await page.getByRole('button', { name: 'Bench Press & 3 variations' }).click();
    await page.getByRole('button', { name: 'Open Flat' }).first().click();
    await capture(page, 'settings-exercise-detail');
    await page.getByRole('button', { name: 'Change rest time, currently Default' }).click();
    await capture(page, 'settings-exercise-rest-picker');
    await page.getByRole('button', { name: 'Use default rest time' }).click();
    await page.getByTestId('forge-sheet-drag-area').getByRole('button', { name: 'Close exercise details' }).click();
    await page.getByRole('button', { name: 'Back to Exercises' }).click();
    await page.getByRole('button', { name: 'Back to Settings' }).click();
    await page.getByRole('button', { name: 'Workout types' }).click();
    await expect(page.getByTestId('settings-detail-title')).toHaveText('Workout types');
    await capture(page, 'settings-workout-types');
    await page.getByRole('button', { name: 'Strength workout type' }).click();
    await capture(page, 'settings-workout-types-expanded');
  });

  test('captures the New Exercise card and its equipment selector', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Exercises' }).click();
    await page.getByRole('button', { name: 'All exercises, 381 exercises' }).click();
    await page.getByRole('button', { name: 'Create custom exercise' }).click();
    await expect(page.getByTestId('custom-exercise-form-surface')).toBeVisible();
    await capture(page, 'settings-new-exercise-sheet');
    await page.getByRole('button', { name: 'Equipment' }).click();
    await expect(page.getByRole('checkbox').first()).toBeVisible();
    await capture(page, 'settings-new-exercise-equipment-selector');
  });

  test('captures History and its workout detail', async ({ page }) => {
    await seedHistory(page);
    await page.goto('/');
    await page.getByRole('tab', { name: 'History' }).click();
    await expect(page.getByRole('button', { name: 'Open Upper push' })).toBeVisible();
    await capture(page, 'history');

    const historyCard = page.getByRole('button', { name: 'Open Upper push' });
    const historyCardBox = await historyCard.boundingBox();
    if (!historyCardBox) throw new Error('Expected History card to be measurable');
    await page.mouse.move(
      historyCardBox.x + historyCardBox.width / 2,
      historyCardBox.y + historyCardBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(historyCardBox.x - 90, historyCardBox.y + historyCardBox.height / 2, {
      steps: 8,
    });
    await page.mouse.up();
    await expect(page.getByRole('button', { name: 'Delete Upper push' })).toBeVisible();
    await capture(page, 'history-swipe-delete');

    await page.mouse.move(
      historyCardBox.x + historyCardBox.width / 2 - 64,
      historyCardBox.y + historyCardBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      historyCardBox.x + historyCardBox.width / 2 + 32,
      historyCardBox.y + historyCardBox.height / 2,
      { steps: 8 },
    );
    await page.mouse.up();
    await expect(page.getByRole('button', { name: 'Delete Upper push' })).toBeHidden();

    await page.getByRole('button', { name: 'Open Upper push' }).click();
    await expect(page.getByTestId('workout-details-summary')).toBeVisible();
    await capture(page, 'workout-detail');
  });

  test('captures the dark History swipe-delete surface', async ({ page }) => {
    await enableDark(page);
    await seedHistory(page);
    await page.goto('/');
    await page.getByRole('tab', { name: 'History' }).click();
    const historyCard = page.getByRole('button', { name: 'Open Upper push' });
    const box = await historyCard.boundingBox();
    if (!box) throw new Error('Expected History card to be measurable');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x - 90, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByRole('button', { name: 'Delete Upper push' })).toBeVisible();
    await capture(page, 'history-swipe-delete-dark');
  });

  test('captures the History workout editor', async ({ page }) => {
    await page.goto('/');
    await openHistoricalEditorCapture(page);
    await expect(page.getByLabel('Workout name')).toBeVisible();
    await capture(page, 'history-workout-editor');
  });

  test('captures the dark History workout editor', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'General' }).click();
    await page.getByRole('button', { name: 'Appearance' }).click();
    await page.getByRole('radio', { name: 'Dark' }).click();
    await page.getByRole('button', { name: 'Back to Settings' }).click();
    await page.getByRole('tab', { name: 'Dashboard' }).click();
    await openHistoricalEditorCapture(page);
    await expect(page.getByLabel('Workout name')).toBeVisible();
    await capture(page, 'history-workout-editor-dark');
  });

  test('captures the historical workout source chooser', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Add historical workout' }).click();
    const sourceChooser = page.getByTestId('historical-workout-source-chooser');
    await expect(sourceChooser).toBeVisible();
    await expect(sourceChooser.getByText('Add historical workout', { exact: true })).toBeVisible();
    await expect(sourceChooser.getByText('From routine or plan', { exact: true })).toBeVisible();
    await capture(page, 'historical-workout-source-chooser');
  });

  test('captures Live Workout and set options', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Start workout' }).click();
    await capture(page, 'dashboard-workout-source-chooser');
    await page.getByTestId('dashboard-workout-source-chooser').getByRole('button', { name: 'Blank workout' }).click();
    await expect(page.getByTestId('add-exercise-catalogue')).toBeVisible();
    await page.getByTestId('forge-sheet-drag-area').getByRole('button', { name: 'Close add exercises' }).click();
    await expect(page.getByRole('button', { name: 'Finish workout' })).toBeVisible();
    await capture(page, 'live-workout');

    await page.getByRole('button', { name: 'Add exercise' }).click();
    await expect(page.getByTestId('add-exercise-catalogue')).toBeVisible();
    await capture(page, 'add-exercises-catalogue');
    await page.getByLabel('Search exercises').fill('bench press');
    await page.getByRole('button', { name: 'Bench Press & 3 variations', exact: true }).click();
    await capture(page, 'add-exercises-bench-press');
    await page
      .getByRole('checkbox', { name: 'Bench Press, Barbell' })
      .click({ force: true });
    await page.getByRole('button', { name: 'Confirm selected exercises' }).click();
    await capture(page, 'live-workout-exercise-metadata');
    await page.getByLabel('Open details for set 1').click();
    await expect(page.getByText('SET KIND', { exact: true })).toBeVisible();
    await capture(page, 'set-options');
  });
});

async function openHistoricalEditorCapture(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Add historical workout' }).click();
  await page.getByRole('button', { name: 'Blank workout' }).click();
  await page.getByLabel('Workout name').fill('Upper push');
  await page.getByLabel('Notes').fill('Felt strong. Good pump.');
  await page.getByRole('button', { name: 'Add attribute' }).click();
  await page.getByLabel('Attribute label').fill('Readiness');
  await page.getByLabel('Attribute value').fill('High');
  await page.getByRole('button', { name: 'Save attribute' }).click();
}
