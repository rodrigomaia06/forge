import { expect, test, type Locator, type Page } from '@playwright/test';

async function startEmptyWorkoutWithExercise(page: Page): Promise<void> {
  await page.goto('/');
  await startBlankWorkout(page);
  await page.getByRole('button', { name: 'Add exercise' }).click();
  await page.getByRole('button', { name: 'Bench Press, 4 variations', exact: true }).click();
  await page.getByRole('button', { name: 'Barbell, 2 variations', exact: true }).click();
  await page
    .getByRole('checkbox', { name: 'Bench Press, Barbell, Standard' })
    .click({ force: true });
  await page.getByRole('button', { name: 'Confirm selected exercises' }).click();
}

async function startBlankWorkout(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page.getByTestId('plans-creation-popover')).toBeVisible();
  await page
    .getByTestId('plans-creation-popover')
    .getByRole('button', { name: 'New workout', exact: true })
    .click();
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

    await startBlankWorkout(page);
    await expect(page.getByText('Workout', { exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Workout', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel workout' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Finish workout' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel workout' })).not.toContainText('Cancel');
    await expect(page.getByRole('button', { name: 'Finish workout' })).toContainText('Finish');
    await expect(
      page.getByRole('button', { name: 'Finish workout' }).getByText('Finish'),
    ).toHaveCSS('font-weight', '500');
    await expect(page.getByText('Elapsed', { exact: true })).toBeVisible();
    await expect(page.getByText('Rest', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Add exercise' }).click();
    await page.getByRole('button', { name: 'Bench Press, 4 variations', exact: true }).click();
    await page.getByRole('button', { name: 'Barbell, 2 variations', exact: true }).click();
    await page
      .getByRole('checkbox', { name: 'Bench Press, Barbell, Standard' })
      .click({ force: true });
    await page.getByRole('button', { name: 'Confirm selected exercises' }).click();

    await expect(page.getByText('Barbell Bench Press', { exact: true })).toBeVisible();
    await page.getByLabel('Weight for set 1').fill('60');
    await page.getByLabel('Reps for set 1').fill('8');
    await page.getByLabel('Complete set 1').click();

    await page.getByRole('button', { name: 'Finish workout' }).click();
    await expect(page.getByTestId('dashboard-header-title').last()).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Workout', exact: true })).toHaveCount(0);
  });

  test('groups exercise variations and selects single-variation exercises directly', async ({
    page,
  }) => {
    await page.goto('/');
    await startBlankWorkout(page);
    await page.getByRole('button', { name: 'Add exercise' }).click();

    await expect(page.getByText('Chest', { exact: true })).toBeVisible();
    await expect(page.getByText('Chest · 12', { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Bench Press, 4 variations', exact: true }),
    ).toBeVisible();

    const search = page.getByLabel('Search exercises');
    await search.fill('pec');
    await expect(page.getByRole('button', { name: 'Clear exercise search' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear exercise search' }).click();
    await expect(search).toHaveValue('');

    const pecDeck = page.getByRole('checkbox', { name: 'Pec Deck, variation' });
    await pecDeck.scrollIntoViewIfNeeded();
    await pecDeck.click();
    await expect(page.getByText('Add exercises (1)', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Bench Press, 4 variations', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Barbell, 2 variations', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Barbell, 2 variations', exact: true }).click();
    await expect(
      page.getByRole('checkbox', { name: 'Bench Press, Barbell, Close grip' }),
    ).toBeVisible();
  });

  test('keeps variation counts legible in Dark appearance', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance: 'dark' }));
    });
    await page.goto('/');
    await startBlankWorkout(page);
    await page.getByRole('button', { name: 'Add exercise' }).click();

    const count = page.getByTestId('exercise-group-count-Bench Press');
    await expect(count).toHaveCSS('background-color', 'rgb(42, 47, 52)');
    await expect(count).toHaveCSS('border-color', 'rgb(58, 64, 70)');
    await expect(count.getByText('0', { exact: true })).toHaveCSS('color', 'rgb(195, 200, 204)');
  });

  test('starts the rest timer from the workout header', async ({ page }) => {
    await page.goto('/');
    await startBlankWorkout(page);

    const restTimer = page.getByRole('button', { name: 'Start rest timer' });
    await expect(restTimer).toBeVisible();
    await restTimer.click();
    await expect(page.getByText('Rest timer', { exact: true })).toBeVisible();
    const closeRestTimer = page.getByRole('button', { name: 'Close rest timer' }).last();
    await expect(closeRestTimer).toHaveCSS('width', '44px');
    await expect(closeRestTimer).toHaveCSS('height', '44px');
    await closeRestTimer.click();
    await expect(page.getByText('Rest timer', { exact: true })).toBeHidden();
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

  test('selects a rest duration by tapping a picker value', async ({ page }) => {
    await page.goto('/');
    await startBlankWorkout(page);
    await page.getByRole('button', { name: 'Start rest timer' }).click();

    await page.getByRole('button', { name: 'Rest duration 02:00' }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Start rest timer', exact: true })
      .click();

    await expect(page.getByRole('dialog').getByText(/02:0[0-9]/)).toBeVisible();
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

  test('opens set details as a sheet from the set number', async ({ page }) => {
    await startEmptyWorkoutWithExercise(page);

    await page.getByLabel('Open details for set 1').click();
    await expect(page.getByText('TYPE', { exact: true })).toBeVisible();
    await expect(page.getByText('NEXT-TIME TARGET', { exact: true })).toBeVisible();
    const readRect = async (selector: string) =>
      page.locator(selector).evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      });
    const targetRects = await page
      .locator('input[aria-label^="Next-time"]')
      .evaluateAll((elements) =>
        elements.map((element) => {
          const rect = element.getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        }),
      );
    if (targetRects.length !== 2) throw new Error('Expected two target inputs to be measurable');
    const [firstTarget, secondTarget] = [...targetRects].sort((a, b) => a.x - b.x);
    expect(secondTarget.x).toBeGreaterThanOrEqual(firstTarget.x + firstTarget.width - 1);
    const typeTitle = await page.getByText('TYPE', { exact: true }).boundingBox();
    const commentTitle = await page.getByText('COMMENT', { exact: true }).boundingBox();
    const targetTitle = await page.getByText('NEXT-TIME TARGET', { exact: true }).boundingBox();
    const commentInput = await page
      .locator('[aria-label="Comment for set 1"]')
      .evaluate((element) => {
        const rect = element.parentElement?.getBoundingClientRect();
        if (!rect) throw new Error('Expected comment field to be measurable');
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      });
    const targetBox = await page
      .locator('input[aria-label^="Next-time"]')
      .first()
      .evaluate((element) => {
        const rect = element.parentElement?.parentElement?.parentElement?.getBoundingClientRect();
        if (!rect) throw new Error('Expected target box to be measurable');
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      });
    expect(targetBox.width).toBeGreaterThanOrEqual(140);
    const typeRow = await page.getByLabel('Select Warm Up type').boundingBox();
    if (!typeTitle || !commentTitle || !targetTitle || !commentInput || !typeRow) {
      throw new Error('Expected set details alignment elements to be measurable');
    }
    expect(Math.abs(typeTitle.x - commentTitle.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(typeTitle.x - targetTitle.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(commentInput.x - (typeRow.x + 14))).toBeLessThanOrEqual(1);
    expect(
      Math.abs(commentInput.x + commentInput.width - (targetBox.x + targetBox.width)),
    ).toBeLessThanOrEqual(2);
    await page.getByRole('button', { name: 'Type help' }).click();
    await expect(
      page.getByText('Choose a type to describe this set.', { exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Type help' }).click();
    await expect(
      page.getByText('Choose a type to describe this set.', { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Done' })).toBeVisible();

    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByText('TYPE', { exact: true })).toHaveCount(0);

    await page.getByLabel('Open details for set 1').click();
    await page.getByLabel('Comment for set 1').fill('Keep this form');
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByText('Keep this form', { exact: true })).toBeVisible();
  });

  test('restarts the rest timer when held', async ({ page }) => {
    await page.goto('/');
    await startBlankWorkout(page);

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
    await page.getByRole('tab', { name: 'Settings' }).click();
    await expect(page.getByTestId('settings-title')).toBeVisible();
    await page.getByRole('tab', { name: 'Dashboard' }).click();
    await expect(page.getByTestId('dashboard-header-title').last()).toBeVisible();
  });

  test('keeps the shared dock visible while a workout is active', async ({ page }) => {
    await page.goto('/');
    const restingDock = await page.getByTestId('dashboard-dock-cylinder').boundingBox();
    await startBlankWorkout(page);
    await expect(page.getByRole('tab', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Workout', exact: true })).toBeVisible();
    await expect(page.getByLabel('Home indicator').last()).toBeVisible();
    await page.getByRole('tab', { name: 'Dashboard' }).click();
    await page.waitForTimeout(300);
    const activeDock = await page.getByTestId('dashboard-dock-cylinder').last().boundingBox();
    expect(restingDock).not.toBeNull();
    expect(activeDock).not.toBeNull();
    if (!restingDock || !activeDock) throw new Error('Expected both dock widths to be measurable');
    expect(activeDock.width).toBeGreaterThan(restingDock.width);
    expect(activeDock.width).toBeLessThanOrEqual(390);
  });

  test('uses a dashed outline for Add exercise', async ({ page }) => {
    await page.goto('/');
    await startBlankWorkout(page);
    const addExercise = page.getByRole('button', { name: 'Add exercise' });
    await expect(addExercise).toHaveCSS('border-style', 'dashed');
    await expect(addExercise).toHaveCSS('border-width', '2px');
  });

  test('keeps the workout dock item available with the active selection indicator', async ({
    page,
  }) => {
    await page.goto('/');
    await startBlankWorkout(page);

    const workoutItem = page.getByRole('tab', { name: 'Workout', exact: true });
    await expect(workoutItem).toBeVisible();
    await expect(page.getByTestId('dashboard-nav-selection-pill')).toHaveCSS(
      'background-color',
      'rgb(29, 37, 45)',
    );

    await page.getByRole('tab', { name: 'Dashboard' }).click();
    await expect(workoutItem).toBeVisible();
  });

  test('keeps compact active-workout dock tabs centred inside the selection pill', async ({
    page,
  }) => {
    await startEmptyWorkoutWithExercise(page);
    const addSet = page.getByRole('button', { name: 'Add set to Barbell Bench Press' });
    for (let count = 0; count < 10; count += 1) await addSet.click();

    const workoutList = page.getByTestId('active-workout-list');
    const listBox = await workoutList.boundingBox();
    if (!listBox) throw new Error('Expected active-workout list to be measurable');
    await page.mouse.move(listBox.x + listBox.width / 2, listBox.y + listBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(listBox.x + listBox.width / 2, listBox.y + 80, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(280);

    const [dock, pill, workoutTab, workoutIcon] = await Promise.all([
      page.getByTestId('dashboard-dock-cylinder').boundingBox(),
      page.getByTestId('dashboard-nav-selection-pill').boundingBox(),
      page.getByRole('tab', { name: 'Workout', exact: true }).boundingBox(),
      page.getByRole('tab', { name: 'Workout', exact: true }).locator('svg').boundingBox(),
    ]);
    if (!dock || !pill || !workoutTab || !workoutIcon)
      throw new Error('Expected compact workout dock geometry to be measurable');

    expect(dock.width).toBeGreaterThanOrEqual(304);
    expect(pill.width).toBeGreaterThanOrEqual(56);
    expect(pill.height).toBeGreaterThanOrEqual(40);
    expect(Math.abs(pill.x + pill.width / 2 - (workoutTab.x + workoutTab.width / 2))).toBeLessThan(
      2,
    );
    expect(
      Math.abs(pill.y + pill.height / 2 - (workoutTab.y + workoutTab.height / 2)),
    ).toBeLessThan(2);
    expect(
      Math.abs(pill.y + pill.height / 2 - (workoutIcon.y + workoutIcon.height / 2)),
    ).toBeLessThan(2);
    expect(workoutIcon.width).toBeGreaterThanOrEqual(32);
    expect(workoutIcon.height).toBeGreaterThanOrEqual(32);
  });

  test('opens the active workout after reloading with a workout in progress', async ({ page }) => {
    await page.goto('/');
    await startBlankWorkout(page);
    await expect(page.getByRole('button', { name: 'Finish workout' })).toBeVisible();

    // Active-workout persistence is debounced so typing and set changes do not write per frame.
    await page.waitForTimeout(350);
    await page.reload();

    await expect(page.getByRole('button', { name: 'Finish workout' })).toBeVisible();
    await expect(page.getByText('Workout', { exact: true })).toBeVisible();
  });

  test('cancels an active workout without saving it', async ({ page }) => {
    await page.goto('/');
    await startBlankWorkout(page);
    await page.getByRole('button', { name: 'Cancel workout' }).click();
    await expect(page.getByRole('button', { name: 'Start workout' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Workout', exact: true })).toHaveCount(0);
  });

  test('removes an exercise from its options sheet', async ({ page }) => {
    await page.goto('/');
    await startBlankWorkout(page);
    await page.getByRole('button', { name: 'Add exercise' }).click();
    await page.getByRole('button', { name: 'Bench Press, 4 variations', exact: true }).click();
    await page.getByRole('button', { name: 'Barbell, 2 variations', exact: true }).click();
    await page
      .getByRole('checkbox', { name: 'Bench Press, Barbell, Standard' })
      .click({ force: true });
    await page.getByRole('button', { name: 'Confirm selected exercises' }).click();
    await page.getByRole('button', { name: 'More options for Barbell Bench Press' }).click();
    await expect(page.getByText('Options', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Remove Barbell Bench Press' }).locator('svg'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Remove Barbell Bench Press' }).click();
    await expect(page.getByText('Start with an exercise', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add exercise' }).last()).toBeVisible();
  });

  test('reveals delete action when swiping an exercise card to the left', async ({ page }) => {
    await startEmptyWorkoutWithExercise(page);

    await swipeLeftFrom(page, page.getByText('Barbell Bench Press', { exact: true }));
    await expect(page.getByRole('button', { name: 'Delete Barbell Bench Press' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete Barbell Bench Press' }).click();
    await expect(page.getByText('Barbell Bench Press', { exact: true })).toHaveCount(0);
  });

  test('reveals delete action when swiping a set to the left', async ({ page }) => {
    await startEmptyWorkoutWithExercise(page);

    const completeButton = page.getByRole('checkbox', { name: 'Complete set 1' });
    await swipeLeftFrom(page, completeButton);

    await expect(page.getByRole('button', { name: 'Delete set 1' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete set 1' }).click();
    await expect(page.getByLabel('Weight for set 1')).toHaveCount(0);
  });

  test('removes the exercise card when its last set is deleted', async ({ page }) => {
    await startEmptyWorkoutWithExercise(page);
    await swipeLeftFrom(page, page.getByLabel('Weight for set 1'));
    await page.getByRole('button', { name: 'Delete set 1' }).click();
    await expect(page.getByText('Barbell Bench Press', { exact: true })).toHaveCount(0);
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
