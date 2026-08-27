import { expect, test } from '@playwright/test';

const completedWorkouts = [
  makeWorkout('muay-thai', 'Muay Thai', 'Martial arts', Date.UTC(2026, 7, 25, 18), 72, 3, 8),
  makeWorkout('pull-25', 'Pull - Extension', 'Strength', Date.UTC(2026, 7, 24, 18), 120, 7, 16),
  makeWorkout('push-20', 'Push - Shoulder', 'Strength', Date.UTC(2026, 7, 20, 18), 84, 4, 12),
  makeWorkout('push-16', 'Push - Chest', 'Strength', Date.UTC(2026, 7, 16, 18), 92, 6, 16),
  makeWorkout('pull-11', 'Pull - Extension', 'Strength', Date.UTC(2026, 7, 11, 18), 4, 4, 10),
];

test.describe('History screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((workouts) => {
      localStorage.setItem('@forge/active-workout', 'null');
      localStorage.setItem('@forge/completed-workouts', JSON.stringify(workouts));
    }, completedWorkouts);
    await page.goto('/');
    await page.getByRole('tab', { name: 'History' }).click();
  });

  test('groups completed sessions by period and renders timeline cards', async ({ page }) => {
    await expect(page.getByText('History', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Filter' })).toBeVisible();
    await expect(page.getByTestId('history-header')).toHaveCSS(
      'background-color',
      'rgb(232, 232, 232)',
    );
    await expect(page.getByText('This week', { exact: true })).toBeVisible();
    await expect(page.getByText('Last week', { exact: true })).toBeVisible();
    await expect(page.getByText('2 weeks ago', { exact: true })).toBeVisible();
    await expect(page.getByText('Muay Thai', { exact: true })).toBeVisible();
    await expect(page.getByText('Martial arts', { exact: true })).toHaveCount(0);
    await expect(page.getByText('3 exercises · 8 sets', { exact: true })).toBeVisible();
    await expect(page.getByText('7 exercises · 16 sets', { exact: true })).toBeVisible();
    await expect(page.getByText('1h 12m', { exact: true })).toBeVisible();
    expect(await page.locator('svg').count()).toBeGreaterThan(0);
  });

  test('keeps history groups in descending order', async ({ page }) => {
    const headings = await page.locator('[data-testid^="history-group-"]').allTextContents();
    expect(headings[0]).toContain('Muay Thai');
    expect(headings.at(-1)).toContain('Pull - Extension');
  });

  test('opens an individual workout with a summary and no rest timer', async ({ page }) => {
    await page.getByRole('button', { name: 'Open Muay Thai' }).click();

    const summary = page.getByTestId('workout-details-summary');
    await expect(summary.getByText('Muay Thai', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Muay Thai', { exact: true })).toBeVisible();
    await expect(summary.getByText('1h 12m', { exact: true })).toBeVisible();
    await expect(summary.getByText('Duration', { exact: true })).toBeVisible();
    await expect(page.getByText('Rest', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Back to History' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to History' })).toContainText('Back');
    await expect(page.getByRole('button', { name: 'Workout options' })).toContainText('More');

    await expect(page.getByText('Exercise 1', { exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'History' })).toHaveAttribute(
      'data-testid',
      'dashboard-nav-active',
    );

    await page.getByRole('tab', { name: 'History' }).click();
    await expect(page.getByTestId('history-header')).toBeVisible();
  });

  test('opens functional workout options and can delete the selected workout', async ({ page }) => {
    await page.getByRole('button', { name: 'Open Muay Thai' }).click();
    await page.getByRole('button', { name: 'Workout options' }).click();
    await expect(page.getByText('Workout options', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Delete Muay Thai' }).click();
    await expect(page.getByTestId('history-header')).toBeVisible();
    await expect(page.getByText('Muay Thai', { exact: true })).toHaveCount(0);
  });

  test('keeps workout details read-only and expands exercises individually', async ({ page }) => {
    await page.getByRole('button', { name: 'Open Muay Thai' }).click();
    await expect(page.getByText('Exercises', { exact: true })).toBeVisible();
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
      'rgb(98, 201, 138)',
    );
    await expect(
      page.getByTestId('workout-details-set-completion-muay-thai-set-0-1'),
    ).not.toHaveCSS('background-color', 'rgb(98, 201, 138)');
    await expect(page.getByLabel('Workout options')).toBeVisible();
    await page.getByRole('button', { name: 'Open details for set 1' }).click();
    await expect(page.getByLabel('Comment for set 1')).toHaveValue('History note');
  });

  test('keeps the empty state available without completed sessions', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('@forge/completed-workouts', '[]');
    });
    await page.reload();
    await page.getByRole('tab', { name: 'History' }).click();
    await expect(page.getByText('No completed workouts', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start a workout' })).toBeVisible();
  });

  test('keeps collapsed History exercise cards compact with the set count beside the name', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Open Muay Thai' }).click();
    const exercise = page.getByTestId('history-exercise-muay-thai-exercise-0');
    await expect(exercise).toContainText('Exercise 1');
    await expect(exercise).toContainText('· 3 sets');
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
        }),
      ),
    })),
  };
}
