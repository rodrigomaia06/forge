import { expect, test } from '@playwright/test';

test('starting a workout while one is in progress shows a resume notice', async ({ page }) => {
  await page.addInitScript(() => {
    const now = Date.now();
    localStorage.setItem('@forge/active-workout', JSON.stringify({
      id: 'active-1', name: 'In progress', type: 'Strength',
      startedAt: now, completedAt: null, durationSeconds: 0,
      exercises: [{ id: 'e1', name: 'Bench Press', trackingType: 'weight-reps',
        sets: [{ id: 's1', weight: '', reps: '', completed: false }] }],
    }));
  });
  await page.goto('/');
  // App opens into the live workout; go to the dashboard while it stays active.
  await page.getByRole('tab', { name: 'Dashboard' }).click();
  await page.getByRole('button', { name: 'Start workout' }).click();
  await page.getByTestId('dashboard-workout-source-chooser').getByRole('button', { name: 'Blank workout' }).click();
  await expect(page.getByTestId('resume-workout-notice')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel' })).toHaveCount(0); // notice has no cancel
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByTestId('resume-workout-notice')).toHaveCount(0);
});
