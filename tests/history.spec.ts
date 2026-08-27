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

  test('groups completed sessions by week and renders the reference rows', async ({ page }) => {
    await expect(page.getByText('History', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Edit history')).toBeVisible();
    await expect(page.getByText('24–25 Aug 2026', { exact: true })).toBeVisible();
    await expect(page.getByText('11–16 Aug 2026', { exact: true })).toBeVisible();
    await expect(page.getByText('Muay Thai', { exact: true })).toBeVisible();
    await expect(page.getByText(/Martial arts/).first()).toBeVisible();
    await expect(page.getByText('1h 12m', { exact: true })).toBeVisible();
    await expect(page.getByText('3 exercises · 8 sets', { exact: true })).toBeVisible();
    await expect(page.getByText('7 exercises · 16 sets', { exact: true })).toBeVisible();
    expect(await page.locator('svg').count()).toBeGreaterThan(0);
  });

  test('keeps history groups in descending order', async ({ page }) => {
    const headings = await page.locator('[data-testid^="history-group-"]').allTextContents();
    expect(headings[0]).toContain('Muay Thai');
    expect(headings.at(-1)).toContain('Pull - Extension');
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
          completed: true,
        }),
      ),
    })),
  };
}
