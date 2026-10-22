import { expect, test, type Locator } from '@playwright/test';

async function expectSheetTitle(title: Locator) {
  await expect(title).toBeVisible();
  await expect(title).toHaveCSS('font-size', '23px');
  await expect(title).toHaveCSS('text-align', 'center');
  expect(await title.evaluate(node => {
    const text = node.getBoundingClientRect();
    const header = node.parentElement!.getBoundingClientRect();
    return Math.abs(text.x + text.width / 2 - header.x - header.width / 2);
  })).toBeLessThanOrEqual(1);
}

for (const appearance of ['light', 'dark']) {
  test(`plan and routine popups omit record-name headings (${appearance})`, async ({ page }, info) => {
    await page.addInitScript(appearance => {
      localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance }));
      localStorage.setItem('@forge/plans-v1', JSON.stringify({ standaloneRoutines: [], plans: [{
        id: 'popup-plan', name: 'Push', createdAt: Date.now(), updatedAt: Date.now(),
        routines: [{ id: 'popup-routine', planId: 'popup-plan', name: 'Chest', type: 'Strength', exercises: [], createdAt: Date.now(), updatedAt: Date.now() }],
      }] }));
    }, appearance);
    await page.goto('/');
    await page.getByRole('tab', { name: 'Plans', exact: true }).click();
    await page.getByRole('button', { name: 'Options for Push', exact: true }).click();
    const planSheet = page.getByTestId('plans-plan-options-sheet');
    await expectSheetTitle(planSheet.getByText('Plan options', { exact: true }));
    await expect(planSheet.getByText('Push', { exact: true })).toHaveCount(0);
    await page.waitForTimeout(400);
    await page.screenshot({ path: info.outputPath(`plan-options-${appearance}.png`) });
    await planSheet.getByRole('button', { name: 'Close Plan options', exact: true }).click();
    await page.getByRole('button', { name: 'Routine actions for Chest', exact: true }).click();
    const routineSheet = page.getByTestId('plans-options-sheet');
    await expectSheetTitle(routineSheet.getByText('Routine options', { exact: true }));
    await expect(routineSheet.getByText('Chest', { exact: true })).toHaveCount(0);
    await page.waitForTimeout(400);
    await page.screenshot({ path: info.outputPath(`routine-options-${appearance}.png`) });
  });

  test(`history exercise options use the standard popup title (${appearance})`, async ({ page }, info) => {
    await page.addInitScript(appearance => {
      localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance }));
      localStorage.setItem('@forge/completed-workouts', JSON.stringify([{
        id: 'popup-workout', name: 'Push - Chest', type: 'Strength',
        startedAt: Date.now() - 3600000, completedAt: Date.now(), durationSeconds: 3600,
        exercises: [{ id: 'popup-exercise', name: 'Bench press', sets: [{ id: 'popup-set', weight: '25', reps: '8', completed: true }] }],
      }]));
    }, appearance);
    await page.goto('/');
    await page.getByRole('tab', { name: 'History', exact: true }).click();
    await page.getByRole('button', { name: 'Open Push - Chest', exact: true }).click();
    await page.getByRole('button', { name: 'More options for Bench press', exact: true }).click();
    const title = page.getByText('Exercise options', { exact: true });
    await expectSheetTitle(title);
    await page.waitForTimeout(400);
    await page.screenshot({ path: info.outputPath(`history-exercise-options-${appearance}.png`) });
    await page.getByRole('button', { name: 'Close Exercise options', exact: true }).click();
    await page.getByRole('button', { name: 'Workout options', exact: true }).click();
    const workoutTitle = page.getByText('Workout options', { exact: true });
    await expectSheetTitle(workoutTitle);
    const sheet = workoutTitle.locator('..').locator('..').locator('..');
    await expect(sheet.getByText('Push - Chest', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Share workout', exact: true })).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: info.outputPath(`workout-options-${appearance}.png`) });
  });
}
