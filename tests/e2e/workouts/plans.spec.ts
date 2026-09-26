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

  test('chooses a blank Dashboard workout source and opens its exercise picker', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Start workout' }).click();
    const sourceChooser = page.getByTestId('dashboard-workout-source-chooser');
    await expect(sourceChooser.getByText('Start workout', { exact: true })).toBeVisible();
    await expect(sourceChooser.getByRole('button', { name: 'From routine or plan' })).toBeVisible();
    await sourceChooser.getByRole('button', { name: 'Blank workout' }).click();
    await expect(page.getByRole('tab', { name: 'Workout', exact: true })).toBeVisible();
    await expect(page.getByTestId('add-exercise-catalogue')).toBeVisible();
    await expect(page.getByTestId('plans-creation-popover')).toHaveCount(0);
  });

  test('chooses and starts a routine from the Dashboard source flow without opening Plans', async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      const now = Date.now();
      localStorage.setItem('@forge/plans-v1', JSON.stringify({
        plans: [],
        standaloneRoutines: [{
          id: 'dashboard-template',
          name: 'Dashboard template',
          type: 'Strength',
          exercises: [],
          createdAt: now,
          updatedAt: now,
        }],
      }));
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Start workout' }).click();
    await page.getByTestId('dashboard-workout-source-chooser')
      .getByRole('button', { name: 'From routine or plan' })
      .click();
    await expect(page.getByText('Standalone routines', { exact: true })).toBeVisible();
    if (testInfo.project.use.isMobile === true) {
      await page.waitForTimeout(250);
      await page.screenshot({ path: testInfo.outputPath('dashboard-routine-source-iphone.png') });
    }
    await page.getByRole('button', { name: 'Use Dashboard template routine' }).click();
    await expect(page.getByRole('tab', { name: 'Workout', selected: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Finish workout' })).toBeVisible();
    await expect(page.getByTestId('dashboard-workout-source-chooser')).toHaveCount(0);
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
    // The normal plan header is a plain label; rename moves into edit mode.
    await expect(page.getByRole('button', { name: 'Rename New plan' })).toHaveCount(0);
    await expect(page.getByText('New plan', { exact: true })).toBeVisible();
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
    await expect(routineActions.getByText('Upper body', { exact: true })).toBeVisible();
    for (const label of ['Start', 'Edit', 'Duplicate', 'Visualize']) {
      await expect(routineActions.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
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
    await expect(page.getByTestId('routine-type-selection-menu')).toBeVisible();
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
    if (testInfo.project.use.isMobile === true) {
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

  test('uses type icons and supports swipe-to-delete for routines and plans', async ({ page }) => {
    // Seed a standalone routine and a plan directly: this exercises the Plans
    // list affordances without depending on the routine editor's save flow.
    await page.addInitScript(() => {
      const now = Date.now();
      localStorage.setItem('@forge/plans-v1', JSON.stringify({
        plans: [{ id: 'edit-plan', name: 'New plan', createdAt: now, updatedAt: now, routines: [] }],
        standaloneRoutines: [{
          id: 'edit-routine',
          name: 'Swipe routine',
          type: 'Strength',
          exercises: [],
          createdAt: now,
          updatedAt: now,
        }],
      }));
    });
    await page.goto('/');
    await page.getByRole('tab', { name: 'Plans' }).click();

    // The routine card shows its type icon and action targets; the normal plan
    // header is a plain label (rename lives in edit mode only).
    await expect(
      page.getByRole('button', { name: 'Start Swipe routine' }).locator('svg'),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Routine actions for Swipe routine' }).locator('svg'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create standalone routine' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add routine to New plan' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rename New plan' })).toHaveCount(0);

    // Deletion is a swipe on the row (no trash button); the destructive Delete
    // control is rendered behind every swipeable row, revealed by the gesture.
    // The gesture itself is exercised on device; here we assert it is wired.
    await expect(page.getByRole('button', { name: 'Delete Swipe routine' })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Delete New plan' })).toHaveCount(1);

    // Edit mode reveals the rename control and hides the create / add affordances.
    await page.getByRole('button', { name: 'Edit plans' }).click();
    await expect(page.getByRole('button', { name: 'Create workout, routine, or plan' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add routine to New plan' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Rename New plan' })).toBeVisible();
    // The plan's delete affordance still spans the card in edit mode.
    await expect(page.getByRole('button', { name: 'Delete New plan' })).toHaveCount(1);
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

  test('keeps an in-progress routine time range editable until it is complete', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Plans' }).click();
    await page.getByRole('button', { name: 'Create workout, routine, or plan' }).click();
    await page.getByTestId('plans-creation-popover').getByRole('button', { name: 'New routine' }).click();
    await page.getByLabel('Routine name').fill('Intervals routine');
    await page.getByRole('button', { name: 'Add exercises to routine' }).click();
    await page.getByRole('checkbox', { name: 'Elliptical, variation' }).click();
    await page.getByRole('button', { name: 'Confirm selected exercises' }).click();

    const exercise = page.getByTestId(/^routine-exercise-/);
    await exercise.getByRole('button', { name: 'Expand Elliptical' }).click();
    const duration = exercise.getByRole('textbox', { name: 'Sec for set 1' });
    if (testInfo.project.use.isMobile === true) {
      await exercise.screenshot({ path: testInfo.outputPath('routine-range-input-iphone.png') });
    }
    await duration.pressSequentially('30-60');
    await expect(duration).toHaveValue('30-60');
    await duration.blur();
    await expect(duration).toHaveValue('30–60');
    await exercise.getByRole('button', { name: 'Open details for set 1' }).click();
    const interval = page.getByRole('textbox', { name: 'Routine sec interval for set 1' });
    await expect(interval).toHaveValue('30–60');
    await page.getByTestId('set-details-sheet').getByRole('button', { name: 'Close Set 1' }).click();
    await expect(exercise.getByLabel('Sec for set 1, routine interval 30–60')).toBeVisible();
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
    await expect(page.getByLabel('Kg for set 1')).toHaveCount(0);
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
    if (testInfo.project.use.isMobile === true) {
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
