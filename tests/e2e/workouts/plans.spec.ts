import { expect, test } from '@playwright/test';

async function swipeLeftFrom(
  page: import('@playwright/test').Page,
  locator: import('@playwright/test').Locator,
) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Expected swipe target to be measurable');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 100, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
}

async function swipeRightFrom(
  page: import('@playwright/test').Page,
  locator: import('@playwright/test').Locator,
) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Expected swipe target to be measurable');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
}

test.describe('Plans and routines', () => {
  test('renders an illustration while Plans is empty', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Plans' }).click();
    await expect(page.getByTestId('plans-empty-illustration')).toBeVisible();
    await expect(page.getByText('Build your first routine', { exact: true })).toBeVisible();
  });

  test('routes the Dashboard creation action into the Plans creation popover', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Start workout' }).click();
    await expect(page.getByText('Plans', { exact: true })).toBeVisible();
    await expect(page.getByTestId('plans-creation-popover')).toBeVisible();
    await expect(
      page
        .getByTestId('plans-creation-popover')
        .getByRole('button', { name: 'New workout', exact: true }),
    ).toBeVisible();
  });

  test('starts a blank workout and creates a plan from the header popover', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Plans' }).click();
    await page.getByRole('button', { name: 'Create workout, routine, or plan' }).click();
    await page
      .getByTestId('plans-creation-popover')
      .getByRole('button', { name: 'New workout plan', exact: true })
      .click();
    await expect(page.getByText('New plan', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Create workout, routine, or plan' }).click();
    await page
      .getByTestId('plans-creation-popover')
      .getByRole('button', { name: 'New workout', exact: true })
      .click();
    await expect(page.getByRole('button', { name: 'Finish workout' })).toBeVisible();
  });

  test('uses option controls rather than drag-and-drop on the Plans root', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Plans' }).click();
    await page.getByRole('button', { name: 'Create workout, routine, or plan' }).click();
    await page
      .getByTestId('plans-creation-popover')
      .getByRole('button', { name: 'New routine' })
      .click();
    await page.getByLabel('Routine name').fill('Options routine');
    await page.getByRole('button', { name: 'Save routine' }).click();
    await page.getByRole('button', { name: 'Create workout, routine, or plan' }).click();
    await page
      .getByTestId('plans-creation-popover')
      .getByRole('button', { name: 'New workout plan' })
      .click();

    await expect(page.getByRole('button', { name: /Drag to reorder/ })).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Routine actions for Options routine' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open options for New plan' })).toBeVisible();
  });

  test('creates a routine only after Save, edits it, and starts it as a workout', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Plans' }).click();
    await page.getByRole('button', { name: 'Create workout, routine, or plan' }).click();
    const menu = page.getByTestId('plans-creation-popover');
    await expect(menu.getByRole('button', { name: 'New workout', exact: true })).toBeVisible();
    await expect(menu.getByRole('button', { name: 'New routine', exact: true })).toBeVisible();
    await expect(menu.getByRole('button', { name: 'New workout plan', exact: true })).toBeVisible();
    await menu.getByRole('button', { name: 'New routine', exact: true }).click();
    await expect(page.getByText('New routine', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Routine name')).toHaveValue('');
    await expect(page.getByText('Type', { exact: true })).toBeVisible();
    const [nameBox, typeBox, noteBox] = await Promise.all([
      page.getByLabel('Routine name').boundingBox(),
      page.getByRole('button', { name: 'Workout type, Strength' }).boundingBox(),
      page.getByLabel('Routine note').boundingBox(),
    ]);
    expect(nameBox?.height).toBeCloseTo(52, 0);
    expect(typeBox?.height).toBeCloseTo(56, 0);
    expect(noteBox?.height).toBeCloseTo(52, 0);
    await expect(page.getByRole('button', { name: 'Save routine' })).toBeDisabled();
    await page.getByLabel('Routine name').fill('Upper body');
    await expect(page.getByRole('button', { name: 'Start Upper body' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Save routine' }).click();
    await expect(page.getByText('Upper body')).toBeVisible();
    await page.getByRole('button', { name: 'Routine actions for Upper body' }).click();
    const routineActions = page.getByTestId('plans-options-sheet');
    await expect(routineActions.getByText('Routine options', { exact: true })).toBeVisible();
    await expect
      .poll(() =>
        routineActions
          .locator('[role="button"]')
          .evaluateAll((buttons) =>
            buttons
              .map((button) => button.getAttribute('aria-label'))
              .filter((label): label is string =>
                ['Start', 'Edit', 'Visualize'].includes(label ?? ''),
              ),
          ),
      )
      .toEqual(['Start', 'Edit', 'Visualize']);
    await expect(
      routineActions.getByRole('button', { name: 'Visualize' }).locator('svg').first(),
    ).toBeVisible();
    await expect(
      routineActions.getByRole('button', { name: 'Edit' }).locator('svg').first(),
    ).toBeVisible();
    await expect(
      routineActions.getByRole('button', { name: 'Start' }).locator('svg').first(),
    ).toBeVisible();
    await routineActions.getByRole('button', { name: 'Edit' }).click();
    await expect(routineActions).toHaveCount(0);
    await page.getByLabel('Routine name').fill('Upper body updated');
    await expect(page.getByLabel('Routine name')).toHaveValue('Upper body updated');
    await page.getByRole('button', { name: 'Save routine' }).click();
    await expect(page.getByText('Upper body updated', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Start Upper body updated' }).click();
    await expect(page.getByLabel('Finish workout')).toBeVisible();
  });

  test('makes saved custom workout types selectable in the routine editor', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Workout types' }).click();
    await page.getByRole('button', { name: 'Add workout type' }).click();
    await page.getByLabel('Workout type name').fill('Recovery');
    await page.getByRole('button', { name: 'Save workout type' }).click();
    await page.getByRole('button', { name: 'Back to Settings' }).click();

    await page.getByRole('tab', { name: 'Plans' }).click();
    await page.getByRole('button', { name: 'Create workout, routine, or plan' }).click();
    await page
      .getByTestId('plans-creation-popover')
      .getByRole('button', { name: 'New routine' })
      .click();
    await page.getByRole('button', { name: 'Workout type, Strength' }).click();
    await expect(page.getByTestId('routine-type-selection-sheet')).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Use Recovery workout type' })).toBeVisible();
    await page.getByRole('radio', { name: 'Use Recovery workout type' }).click();
    await expect(page.getByRole('button', { name: 'Workout type, Recovery' })).toBeVisible();
    await page.getByLabel('Routine name').fill('Recovery routine');
    await page.getByRole('button', { name: 'Save routine' }).click();
    await page.getByRole('button', { name: 'Routine actions for Recovery routine' }).click();
    await page.getByTestId('plans-options-sheet').getByRole('button', { name: 'Edit' }).click();
    await page.getByRole('button', { name: 'Workout type, Recovery' }).click();
    await page.getByRole('radio', { name: 'Use Strength workout type' }).click();
    await expect(page.getByRole('button', { name: 'Workout type, Strength' })).toBeVisible();
    await page.getByRole('button', { name: 'Workout type, Strength' }).click();
    await page.getByRole('radio', { name: 'Use Recovery workout type' }).click();
    await expect(page.getByRole('button', { name: 'Workout type, Recovery' })).toBeVisible();
  });

  test('keeps a long routine workout-type list inside a bounded scroller', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Workout types' }).click();
    for (let index = 1; index <= 14; index += 1) {
      await page.getByRole('button', { name: 'Add workout type' }).click();
      await page.getByLabel('Workout type name').fill(`Long picker type ${index}`);
      await page.getByRole('button', { name: 'Save workout type' }).click();
    }
    await page.getByRole('button', { name: 'Back to Settings' }).click();

    await page.getByRole('tab', { name: 'Plans' }).click();
    await page.getByRole('button', { name: 'Create workout, routine, or plan' }).click();
    await page
      .getByTestId('plans-creation-popover')
      .getByRole('button', { name: 'New routine' })
      .click();
    await page.getByRole('button', { name: 'Workout type, Strength' }).click();

    const typeScroll = page.getByTestId('routine-type-selection-scroll');
    await expect(typeScroll).toBeVisible();
    const hasOverflow = await typeScroll.evaluate((element) => element.scrollHeight > element.clientHeight);
    expect(hasOverflow).toBe(true);
    const scrollTop = await typeScroll.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      return element.scrollTop;
    });
    expect(scrollTop).toBeGreaterThan(0);
    const lastType = page.getByRole('radio', { name: 'Use Long picker type 14 workout type' });
    await expect(lastType).toBeInViewport();
    if (testInfo.project.name === 'iphone-air') {
      await page.screenshot({ path: testInfo.outputPath('routine-type-picker-scroll-iphone.png') });
    }
  });

  test('uses a centred Forge confirmation card to keep or discard an edited routine draft', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Plans' }).click();
    await page.getByRole('button', { name: 'Create workout, routine, or plan' }).click();
    await page
      .getByTestId('plans-creation-popover')
      .getByRole('button', { name: 'New routine' })
      .click();
    await page.getByLabel('Routine name').fill('Discarded routine');
    await page.getByRole('button', { name: 'Cancel editing routine' }).click();

    const confirmation = page.getByTestId('routine-confirmation-sheet');
    await expect(confirmation.getByText('Discard changes?', { exact: true })).toBeVisible();
    await expect(confirmation.getByRole('button', { name: 'Keep editing' })).toBeVisible();
    await expect(confirmation.getByRole('button', { name: 'Discard changes', exact: true })).toBeVisible();
    await confirmation.getByRole('button', { name: 'Keep editing' }).click();
    await expect(page.getByLabel('Routine name')).toHaveValue('Discarded routine');

    await page.getByRole('button', { name: 'Cancel editing routine' }).click();
    await confirmation.getByRole('button', { name: 'Discard changes', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Routine actions for Discarded routine' })).toHaveCount(0);
  });

  test('uses type icons and supports swipe deletion for routines and plans', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Plans' }).click();
    await page.getByRole('button', { name: 'Create workout, routine, or plan' }).click();
    await page
      .getByTestId('plans-creation-popover')
      .getByRole('button', { name: 'New routine' })
      .click();
    await page.getByLabel('Routine name').fill('Swipe routine');
    await page.getByRole('button', { name: 'Save routine' }).click();

    const routine = page.locator('[data-testid^="routine-swipe-"]').first();
    await expect(
      routine.getByRole('button', { name: 'Start Swipe routine' }).locator('svg'),
    ).toBeVisible();
    await expect(
      routine.getByRole('button', { name: 'Routine actions for Swipe routine' }).locator('svg'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create standalone routine' })).toHaveCount(0);
    await swipeLeftFrom(page, routine);
    const deleteRoutine = page.getByRole('button', { name: 'Delete Swipe routine' });
    await expect(deleteRoutine).toBeVisible();
    await deleteRoutine.click();
    await expect(page.getByText('Swipe routine', { exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'Create workout, routine, or plan' }).click();
    await page
      .getByTestId('plans-creation-popover')
      .getByRole('button', { name: 'New workout plan' })
      .click();
    await page.getByRole('button', { name: 'Open options for New plan' }).click();
    const planOptions = page.getByTestId('plans-options-sheet');
    await expect(planOptions.getByText('Plan options', { exact: true })).toBeVisible();
    await expect(
      planOptions.getByRole('button', { name: 'Add routine' }).locator('svg'),
    ).toHaveCount(2);
    await expect(
      planOptions.getByRole('button', { name: 'Delete plan' }).locator('svg'),
    ).toHaveCount(1);
    await page.getByRole('button', { name: 'Dismiss plan options' }).click();
    await expect(planOptions).toHaveCount(0);
    const plan = page.locator('[data-testid^="plan-swipe-"]').first();
    await swipeLeftFrom(page, plan);
    const deletePlan = page.getByRole('button', { name: 'Delete New plan' });
    await expect(deletePlan).toBeVisible();
    const [planBox, deletePlanBox] = await Promise.all([
      plan.boundingBox(),
      deletePlan.boundingBox(),
    ]);
    expect(deletePlanBox?.height).toBeCloseTo(planBox?.height ?? 0, 0);
    await deletePlan.click();
    await expect(page.getByText('New plan', { exact: true })).toHaveCount(0);
  });

  test('uses the shared action sheet for persisted routine-editor overflow actions', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Plans' }).click();
    await page.getByRole('button', { name: 'Create workout, routine, or plan' }).click();
    await page
      .getByTestId('plans-creation-popover')
      .getByRole('button', { name: 'New workout plan' })
      .click();
    await page.getByRole('button', { name: 'Create workout, routine, or plan' }).click();
    await page
      .getByTestId('plans-creation-popover')
      .getByRole('button', { name: 'New routine' })
      .click();
    await page.getByLabel('Routine name').fill('Move routine');
    await page.getByRole('button', { name: 'Save routine' }).click();
    await page.getByRole('button', { name: 'Routine actions for Move routine' }).click();
    await page.getByTestId('plans-options-sheet').getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByTestId('plans-options-sheet')).toHaveCount(0);
    await page.getByRole('button', { name: 'Routine options', exact: true }).click();
    const routineOptions = page.getByTestId('routine-options-sheet');
    await expect(routineOptions.getByText('Routine options', { exact: true })).toBeVisible();
    await expect(
      routineOptions.getByRole('button', { name: 'Move to a plan' }).locator('svg'),
    ).toHaveCount(2);
    await expect(
      routineOptions.getByRole('button', { name: 'Delete routine' }).locator('svg'),
    ).toHaveCount(1);
    await page.getByRole('button', { name: 'Move to a plan' }).click();
    await expect(routineOptions).toHaveCount(0);
    await expect(page.getByText('Part of New plan', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Save routine' }).click();
  });

  test('adds, edits, and removes routine attributes in the local editor draft', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Plans' }).click();
    await page.getByRole('button', { name: 'Create workout, routine, or plan' }).click();
    await page
      .getByTestId('plans-creation-popover')
      .getByRole('button', { name: 'New routine' })
      .click();
    await page.getByLabel('Routine name').fill('Attributes routine');
    await page.getByRole('button', { name: 'Add attribute' }).click();
    await page.getByLabel('Attribute label').fill('Mood');
    await page.getByRole('button', { name: 'Save attribute' }).click();
    await expect(page.getByRole('button', { name: 'Edit Mood attribute' })).toBeVisible();
    await page.getByRole('button', { name: 'Edit Mood attribute' }).click();
    await page.getByLabel('Attribute value').fill('Focused');
    await page.getByRole('button', { name: 'Save attribute' }).click();
    await page.getByRole('button', { name: 'Edit Mood attribute' }).click();
    await page.getByRole('button', { name: 'Remove attribute' }).click();
    await expect(page.getByRole('button', { name: 'Edit Mood attribute' })).toHaveCount(0);
    // Re-focus the virtualized header field after nested sheets on compact web.
    await page.getByLabel('Routine name').fill('Attributes routine');
    await page.getByRole('button', { name: 'Save routine' }).click();
    await expect(page.getByText('Attributes routine', { exact: true })).toBeVisible();
  });

  test('copies routine attribute names into a live workout with blank, editable values', async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Plans' }).click();
    await page.getByRole('button', { name: 'Create workout, routine, or plan' }).click();
    await page.getByTestId('plans-creation-popover').getByRole('button', { name: 'New routine' }).click();
    await page.getByLabel('Routine name').fill('Attribute template');
    await page.getByRole('button', { name: 'Add attribute' }).click();
    await page.getByLabel('Attribute label').fill('Mood');
    await page.getByLabel('Attribute value').fill('Template value');
    await page.getByRole('button', { name: 'Save attribute' }).click();
    await page.getByRole('button', { name: 'Add attribute' }).click();
    await page.getByLabel('Attribute label').fill('Location');
    await page.getByRole('button', { name: 'Save attribute' }).click();
    // Re-focus the virtualized header field before saving on compact web profiles.
    await page.getByLabel('Routine name').fill('Attribute template');
    await page.getByRole('button', { name: 'Save routine' }).click();
    await page.getByRole('button', { name: 'Start Attribute template' }).click();

    const mood = page.getByLabel('Mood value');
    const location = page.getByLabel('Location value');
    const liveWorkoutList = page.getByTestId('active-workout-list');
    await expect(mood).toHaveValue('');
    await expect(location).toHaveValue('');
    await expect(liveWorkoutList.getByText('Attributes', { exact: true })).toBeVisible();
    await expect(liveWorkoutList.getByText('Mood', { exact: true })).toBeVisible();
    await expect(liveWorkoutList.getByText('Location', { exact: true })).toBeVisible();
    await expect(page.getByTestId('live-attribute-icon-Mood').first()).toBeVisible();
    await expect(liveWorkoutList.getByText('Exercises', { exact: true })).toHaveCount(0);
    await page.waitForTimeout(220);
    await page.screenshot({ path: testInfo.outputPath('live-workout-attributes-compact.png') });
    await mood.fill('Focused');
    await expect(mood).toHaveValue('Focused');
    await location.fill('Home gym');
    await expect(location).toHaveValue('Home gym');
    await page.getByRole('button', { name: 'Add exercise' }).click();
    await page.getByRole('checkbox', { name: 'Elliptical, variation' }).click();
    await page.getByRole('button', { name: 'Confirm selected exercises' }).click();
    await expect(liveWorkoutList.getByText('Exercises', { exact: true })).toBeVisible();
    await page.waitForTimeout(220);
    await page.screenshot({ path: testInfo.outputPath('live-workout-attributes-and-exercises.png') });
  });

  test('uses the Live Workout exercise picker and supports opening and swiping routine exercises', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Plans' }).click();
    await page.getByRole('button', { name: 'Create workout, routine, or plan' }).click();
    await page
      .getByTestId('plans-creation-popover')
      .getByRole('button', { name: 'New routine' })
      .click();
    await page.getByLabel('Routine name').fill('Exercise routine');
    await page.getByRole('button', { name: 'Add exercises to routine' }).click();
    await page.getByRole('button', { name: 'Bench Press & 3 variations', exact: true }).click();
    await page.getByRole('button', { name: 'Barbell & 2 variations', exact: true }).click();
    await page
      .getByRole('checkbox', { name: 'Bench Press, Barbell, Flat' })
      .click({ force: true });
    await page.getByRole('button', { name: 'Confirm selected exercises' }).click();

    const exercise = page.getByTestId(/^routine-exercise-/);
    await expect(exercise).toHaveCount(1);
    const expandExercise = exercise.getByRole('button', { name: 'Expand Barbell Bench Press' });
    await expect(expandExercise).toBeVisible();
    await expect(expandExercise.locator('svg').last()).toBeVisible();
    await expect(
      exercise.getByRole('button', { name: 'Drag to reorder Barbell Bench Press' }),
    ).toBeVisible();
    await expect(
      exercise.getByRole('button', { name: 'More options for Barbell Bench Press' }),
    ).toHaveCount(0);
    await expandExercise.click();
    const collapseExercise = exercise.getByRole('button', { name: 'Collapse Barbell Bench Press' });
    await expect(collapseExercise.locator('svg').last()).toBeVisible();
    await expect(exercise.getByRole('checkbox')).toHaveCount(0);
    const [exerciseNameBox, setCountBox] = await Promise.all([
      exercise.getByText('Barbell Bench Press', { exact: true }).boundingBox(),
      exercise.getByText('3 sets', { exact: true }).boundingBox(),
    ]);
    expect((setCountBox?.y ?? 0) - (exerciseNameBox?.y ?? 0)).toBeLessThan(30);
    await expect(
      exercise.getByRole('button', { name: 'Add set to Barbell Bench Press' }),
    ).toBeVisible();
    await swipeLeftFrom(page, exercise);
    await expect(
      exercise.getByRole('button', { name: 'Delete Barbell Bench Press' }),
    ).toBeVisible();
    await swipeRightFrom(page, exercise);
    await expect(exercise.getByText('Barbell Bench Press', { exact: true })).toBeVisible();
  });

  test('keeps routine view read-only and reserves exercise reordering for Edit', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Plans' }).click();
    await page.getByRole('button', { name: 'Create workout, routine, or plan' }).click();
    await page
      .getByTestId('plans-creation-popover')
      .getByRole('button', { name: 'New routine' })
      .click();
    await page.getByLabel('Routine name').fill('Read-only routine');
    await page.getByRole('button', { name: 'Add exercises to routine' }).click();
    await page.getByRole('button', { name: 'Bench Press & 3 variations', exact: true }).click();
    await page.getByRole('button', { name: 'Barbell & 2 variations', exact: true }).click();
    await page
      .getByRole('checkbox', { name: 'Bench Press, Barbell, Flat' })
      .click({ force: true });
    await page.getByRole('button', { name: 'Confirm selected exercises' }).click();
    await page.getByRole('button', { name: 'Save routine' }).click();
    await page.getByRole('button', { name: 'Routine actions for Read-only routine' }).click();
    await page.getByTestId('plans-options-sheet').getByRole('button', { name: 'Visualize' }).click();

    await expect(page.getByLabel('Routine name')).toHaveAttribute('readonly', '');
    await expect(page.getByLabel('Routine note')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Workout type, Strength' }).locator('svg')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add exercises to routine' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Drag to reorder Barbell Bench Press' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Expand Barbell Bench Press' }).click();
    await expect(page.getByRole('button', { name: 'Add set to Barbell Bench Press' })).toHaveCount(0);
    await expect(page.getByLabel('Weight for set 1')).toHaveCount(0);
    await expect(page.locator('[data-testid^="workout-details-set-"]').first()).toHaveCSS(
      'border-bottom-width',
      '0px',
    );
  });

  test('attaches a plan routine only after Save and uses a compact plan header', async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Plans' }).click();
    await page.getByRole('button', { name: 'Create workout, routine, or plan' }).click();
    await page
      .getByTestId('plans-creation-popover')
      .getByRole('button', { name: 'New workout plan' })
      .click();
    const header = page.getByTestId(/^plan-header-/);
    await expect(header).toHaveCount(1);
    await expect(page.getByText(/^[0-9]+ routines?$/)).toHaveCount(0);
    const headerBox = await header.boundingBox();
    expect(headerBox?.height).toBeCloseTo(56, 0);

    await page.getByRole('button', { name: 'Add routine to New plan' }).click();
    await page.getByLabel('Routine name').fill('Plan draft');
    await expect(page.getByRole('button', { name: 'Start Plan draft' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Save routine' }).click();
    await expect(page.getByText('Plan draft', { exact: true })).toBeVisible();
    const routineActionButton = page.getByRole('button', { name: 'Routine actions for Plan draft' });
    await expect(routineActionButton).toContainText('Strength');
    await expect(routineActionButton).not.toContainText('0 exercises');
    await expect(routineActionButton).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    if (testInfo.project.name === 'iphone-air') {
      await page.screenshot({ path: testInfo.outputPath('plans-root-forge-cards-iphone.png') });
    }
    await routineActionButton.click();
    const routineActions = page.getByTestId('plans-options-sheet');
    await expect(routineActions.getByRole('button', { name: 'Visualize' })).toBeVisible();
    await expect(routineActions.getByRole('button', { name: 'Edit' })).toBeVisible();
    await expect(routineActions.getByRole('button', { name: 'Start' })).toBeVisible();
    await routineActions.getByRole('button', { name: 'Start' }).click();
    await expect(page.getByText('New plan - Plan draft', { exact: true })).toBeVisible();
  });
});
