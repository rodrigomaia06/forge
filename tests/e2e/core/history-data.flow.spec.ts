import { expect, test } from '@playwright/test';
import { addExerciseFromPicker, expectVerticalOrder, startBlankWorkout } from '../support/workoutFlow';

test.describe('Core flow: history and data', () => {
  test('persists a completed workout and imports plans in source order', async ({ page }) => {
    await page.goto('/');
    await startBlankWorkout(page);
    await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
    await addExerciseFromPicker(page, 'barbell bench press', 'Bench Press, variation');
    await page.getByLabel('Kg for set 1').fill('60');
    await page.getByLabel('Reps for set 1').fill('10');
    await page.getByRole('button', { name: 'Finish workout' }).click();
    await page.getByTestId('finish-workout-confirmation').getByRole('button', { name: 'Finish workout' }).click();
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
    await page.getByRole('button', { name: 'Import data' }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles({
      name: 'ordered-forge-import.forge',
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
    await expect(page.getByTestId('settings-detail-title').last()).toHaveText('Import');
    await page.getByRole('button', { name: /Import \d+ item/ }).click();
    await page.getByTestId('import-selection-summary').getByRole('button', { name: 'Done' }).click();
    await page.getByRole('button', { name: 'Back to Settings' }).click();
    await page.getByRole('tab', { name: 'Plans' }).click();
    // The plan lists its routines inline on the card; there is no options popup.
    // Scope to the Plans-only action rows so the hidden Dashboard start card
    // (which also renders a suggested routine name) cannot match.
    const first = page.getByRole('button', { name: 'Routine actions for Routine first' });
    const second = page.getByRole('button', { name: 'Routine actions for Routine second' });
    await expect(first).toBeVisible();
    await expect(second).toBeVisible();
    await expectVerticalOrder(first, second);
    await first.click();
    await page.getByTestId('plans-options-sheet').getByRole('button', { name: 'Start', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Finish workout' })).toBeVisible();
  });
});
