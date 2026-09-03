import { expect, test, type Page } from '@playwright/test';

const captureDirectory = 'tests/results/captures';

const completedWorkouts = [
  {
    id: 'capture-upper-push',
    name: 'Upper push',
    type: 'Strength',
    startedAt: Date.UTC(2026, 7, 24, 7, 22),
    completedAt: Date.UTC(2026, 7, 24, 8, 14),
    durationSeconds: 52 * 60,
    averageRestSeconds: 83,
    location: 'Gym',
    mood: 'Great',
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
  await page.screenshot({ path: `${captureDirectory}/${name}.png`, fullPage: true });
}

test.describe('Forge screen captures', () => {
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
    await expect(page.getByText('Edit routine', { exact: true })).toBeVisible();
    await capture(page, 'routine-editor');
    await page.getByRole('button', { name: 'Back to Plans' }).click();

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

    await page.getByRole('button', { name: 'All exercises, 21 exercises' }).click();
    await expect(page.getByTestId('settings-detail-title').last()).toHaveText('All exercises');
    await capture(page, 'settings-exercise-browser');
    await page.getByRole('button', { name: 'Filters' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await capture(page, 'settings-exercise-filter-sheet');

    await page.getByRole('button', { name: 'Done' }).click();
    await page.getByRole('button', { name: 'Bench Press, 4 variations' }).click();
    await page.getByRole('button', { name: 'Standard' }).click();
    await capture(page, 'settings-exercise-detail');
    await page.getByRole('button', { name: 'Change rest time, currently Default' }).click();
    await capture(page, 'settings-exercise-rest-picker');
    await page.getByRole('button', { name: 'Use default rest time' }).click();
    await page.getByLabel('Close exercise details').click();
    await page.getByRole('button', { name: 'Back to Exercises' }).click();
    await page.getByRole('button', { name: 'Back to Settings' }).click();
    await page.getByRole('button', { name: 'Workout types' }).click();
    await expect(page.getByTestId('settings-detail-title')).toHaveText('Workout types');
    await capture(page, 'settings-workout-types');
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
    await seedHistory(page);
    await page.goto('/');
    await page.getByRole('tab', { name: 'History' }).click();
    await page.getByRole('button', { name: 'Open Upper push' }).click();
    await page.getByRole('button', { name: 'Workout options' }).click();
    await page.getByRole('button', { name: 'Edit workout' }).click();
    await expect(page.getByLabel('Workout name')).toBeVisible();
    await capture(page, 'history-workout-editor');
  });

  test('captures Live Workout and set options', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Start workout' }).click();
    await page
      .getByTestId('plans-creation-popover')
      .getByRole('button', { name: 'New workout', exact: true })
      .click();
    await expect(page.getByRole('button', { name: 'Finish workout' })).toBeVisible();
    await capture(page, 'live-workout');

    await page.getByRole('button', { name: 'Add exercise' }).click();
    await page.getByRole('button', { name: 'Bench Press, 4 variations', exact: true }).click();
    await page.getByRole('button', { name: 'Barbell, 2 variations', exact: true }).click();
    await page
      .getByRole('checkbox', { name: 'Bench Press, Barbell, Standard' })
      .click({ force: true });
    await page.getByRole('button', { name: 'Confirm selected exercises' }).click();
    await page.getByLabel('Open details for set 1').click();
    await expect(page.getByText('TYPE', { exact: true })).toBeVisible();
    await capture(page, 'set-options');
  });
});
