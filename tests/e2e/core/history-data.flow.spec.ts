import { expect, test } from '@playwright/test';
import { addExerciseFromPicker, expectVerticalOrder, startBlankWorkout } from '../support/workoutFlow';

test.describe('Core flow: history and data', () => {
  test('persists a completed workout and imports plans in source order', async ({ page }) => {
    await page.goto('/');
    await startBlankWorkout(page);
    await addExerciseFromPicker(page, 'barbell bench press', 'Bench Press, variation');
    await page.getByLabel('Kg for set 1').fill('60');
    await page.getByLabel('Reps for set 1').fill('10');
    await page.getByRole('button', { name: 'Finish workout' }).click();
    await page.getByRole('tab', { name: 'History' }).click();
    await expect(page.getByRole('button', { name: 'Open Workout' })).toBeVisible();
    await page.goto('/');
    await page.getByRole('tab', { name: 'History' }).click();
    await page.getByRole('button', { name: 'Open Workout' }).click();
    await expect(page.getByText('Barbell Bench Press', { exact: true })).toBeVisible();

    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Backup & Export' }).click();
    const chooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Import JSON' }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles({
      name: 'ordered-forge-import.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({
        format: 'forge-data',
        version: 1,
        exportedAt: '2026-09-14T00:00:00.000Z',
        settings: { workoutTypes: [], dailyMeasurementDefinitions: [], dailyMeasurementEntries: [] },
        plans: {
          plans: [{
            id: 'ordered-plan', name: 'Ordered plan', createdAt: 1, updatedAt: 1,
            routines: [
              { id: 'routine-first', name: 'Routine first', type: 'Strength', exercises: [], createdAt: 1, updatedAt: 1 },
              { id: 'routine-second', name: 'Routine second', type: 'Strength', exercises: [], createdAt: 2, updatedAt: 2 },
            ],
          }],
          standaloneRoutines: [],
        },
        workouts: { activeWorkout: null, completedWorkouts: [] },
        customExercises: [],
      })),
    });
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Review selected data' }).click();
    await dialog.getByRole('button', { name: 'Import selected data' }).click();
    await page.getByTestId('data-merged-summary').getByRole('button', { name: 'Done' }).click();
    await page.getByRole('button', { name: 'Back to Settings' }).click();
    await page.getByRole('tab', { name: 'Plans' }).click();
    await page.getByRole('button', { name: 'Open options for Ordered plan' }).click();
    const first = page.getByText('Routine first', { exact: true });
    const second = page.getByText('Routine second', { exact: true });
    await expect(first).toBeVisible();
    await expect(second).toBeVisible();
    await expectVerticalOrder(first, second);
    await page.getByRole('button', { name: 'Dismiss plan options' }).click();
    await page.getByRole('button', { name: 'Start Routine first' }).click();
    await expect(page.getByRole('button', { name: 'Finish workout' })).toBeVisible();
  });
});
