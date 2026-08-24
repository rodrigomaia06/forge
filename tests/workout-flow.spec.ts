import { expect, test, type Locator, type Page } from '@playwright/test';

async function startEmptyWorkoutWithExercise(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await page.getByRole('button', { name: 'Add exercise' }).click();
  await page.getByLabel('Exercise name').fill('Bench press');
  await page.getByRole('button', { name: 'Add exercise', exact: true }).last().click();
}

async function swipeLeftFrom(page: Page, locator: Locator): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error('Expected swipe target to be measurable');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 100, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
}

test.describe('Active workout flow', () => {
  test('starts, records an exercise and finishes a workout', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Start workout' }).click();
    await expect(page.getByText('Workout', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Workout', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Add exercise' }).click();
    await page.getByLabel('Exercise name').fill('Bench press');
    await page.getByRole('button', { name: 'Add exercise', exact: true }).last().click();

    await expect(page.getByText('Bench press', { exact: true })).toBeVisible();
    await page.getByLabel('Weight for set 1').fill('60');
    await page.getByLabel('Reps for set 1').fill('8');
    await page.getByLabel('Complete set 1').click();

    await page.getByRole('button', { name: 'Finish' }).click();
    await expect(page.getByTestId('dashboard-header-title').last()).toBeVisible();
    await expect(page.getByText('Workout', { exact: true })).toBeVisible();
  });

  test('starts the rest timer from the workout header', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Start workout' }).click();

    const restTimer = page.getByRole('button', { name: 'Start rest timer' });
    await expect(restTimer).toBeVisible();
    await restTimer.click();
    await expect(page.getByText('Rest timer', { exact: true })).toBeVisible();
    await page.getByTestId('rest-timer-backdrop').click({ position: { x: 4, y: 4 } });
    await expect(page.getByText('Rest timer', { exact: true })).toBeHidden();
    await restTimer.click();
    await expect(page.getByText('Rest timer', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Start rest timer', exact: true }).last().click();
    await expect(page.getByRole('button', { name: /Rest timer,/ })).toBeVisible();
    await expect(page.getByRole('dialog').getByText(/01:2[0-9]/)).toBeVisible();
    await expect(page.getByText('remaining', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Increase rest by 15 seconds' }).click();
    await page.getByRole('button', { name: 'Skip rest timer' }).click();
    await expect(page.getByRole('button', { name: 'Start rest timer' }).first()).toBeVisible();
  });

  test('marks missing set inputs before allowing completion', async ({ page }) => {
    await startEmptyWorkoutWithExercise(page);

    await page.getByRole('checkbox', { name: 'Complete set 1' }).click();
    await expect(page.getByLabel('Weight for set 1')).toHaveCSS(
      'border-top-color',
      'rgb(255, 59, 48)',
    );
    await expect(page.getByLabel('Reps for set 1')).toHaveCSS(
      'border-top-color',
      'rgb(255, 59, 48)',
    );
    await page.waitForTimeout(1300);
    await expect(page.getByLabel('Weight for set 1')).not.toHaveCSS(
      'border-top-color',
      'rgb(255, 59, 48)',
    );
    await expect(page.getByLabel('Reps for set 1')).not.toHaveCSS(
      'border-top-color',
      'rgb(255, 59, 48)',
    );

    await page.getByLabel('Weight for set 1').fill('60');
    await expect(page.getByLabel('Weight for set 1')).not.toHaveCSS(
      'border-top-color',
      'rgb(255, 59, 48)',
    );
    await page.getByLabel('Reps for set 1').fill('8');
    await page.getByRole('checkbox', { name: 'Complete set 1' }).click();
    await expect(page.getByRole('checkbox', { name: 'Set 1 completed' })).toBeVisible();
  });

  test('restarts the rest timer when held', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Start workout' }).click();

    const restTimer = page.getByRole('button', { name: 'Start rest timer' });
    const box = await restTimer.boundingBox();
    if (!box) throw new Error('Expected rest timer to be measurable');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(550);
    await page.mouse.up();

    await expect(page.getByRole('button', { name: /Rest timer,/ })).toBeVisible();
    await expect(page.getByText('Rest timer', { exact: true })).toHaveCount(0);
  });

  test('navigates between the primary destinations', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'History' }).click();
    await expect(page.getByText('History', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Plans' }).click();
    await expect(page.getByText('Plans', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'More' }).click();
    await expect(page.getByText('More', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Dashboard' }).click();
    await expect(page.getByTestId('dashboard-header-title').last()).toBeVisible();
  });

  test('keeps the shared dock visible while a workout is active', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Start workout' }).click();
    await expect(page.getByRole('tab', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Workout', exact: true })).toBeVisible();
    await expect(page.getByLabel('Home indicator').last()).toBeVisible();
  });

  test('removes an exercise from its options sheet', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Start workout' }).click();
    await page.getByRole('button', { name: 'Add exercise' }).click();
    await page.getByLabel('Exercise name').fill('Bench press');
    await page.getByRole('button', { name: 'Add exercise', exact: true }).last().click();
    await page.getByRole('button', { name: 'More options for Bench press' }).click();
    await page.getByRole('button', { name: 'Remove Bench press' }).click();
    await expect(page.getByText('Start with an exercise', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add exercise' }).last()).toBeVisible();
  });

  test('reveals delete action when swiping a set to the left', async ({ page }) => {
    await startEmptyWorkoutWithExercise(page);

    const completeButton = page.getByRole('checkbox', { name: 'Complete set 1' });
    await swipeLeftFrom(page, completeButton);

    await expect(page.getByRole('button', { name: 'Delete set 1' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete set 1' }).click();
    await expect(page.getByLabel('Weight for set 1')).toHaveCount(0);
  });

  test('reveals delete action when swiping from a weight input', async ({ page }) => {
    await startEmptyWorkoutWithExercise(page);
    await swipeLeftFrom(page, page.getByLabel('Weight for set 1'));
    await expect(page.getByRole('button', { name: 'Delete set 1' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete set 1' }).click();
    await expect(page.getByLabel('Weight for set 1')).toHaveCount(0);
  });

  test('reveals delete action when swiping from a reps input', async ({ page }) => {
    await startEmptyWorkoutWithExercise(page);
    await swipeLeftFrom(page, page.getByLabel('Reps for set 1'));
    await expect(page.getByRole('button', { name: 'Delete set 1' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete set 1' }).click();
    await expect(page.getByLabel('Reps for set 1')).toHaveCount(0);
  });
});
