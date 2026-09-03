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

  test('creates a routine only after Save, edits it, and starts it as a workout', async ({ page }) => {
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
              .filter((label): label is string => ['Start', 'Edit', 'Visualize'].includes(label ?? '')),
          ),
      )
      .toEqual(['Start', 'Edit', 'Visualize']);
    await expect(routineActions.getByRole('button', { name: 'Visualize' }).locator('svg').first()).toBeVisible();
    await expect(routineActions.getByRole('button', { name: 'Edit' }).locator('svg').first()).toBeVisible();
    await expect(routineActions.getByRole('button', { name: 'Start' }).locator('svg').first()).toBeVisible();
    await routineActions.getByRole('button', { name: 'Edit' }).click();
    await expect(routineActions).toHaveCount(0);
    await page.getByLabel('Routine name').fill('Upper body updated');
    await expect(page.getByLabel('Routine name')).toHaveValue('Upper body updated');
    await page.getByRole('button', { name: 'Save routine' }).click();
    await expect(page.getByText('Upper body updated', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Start Upper body updated' }).click();
    await expect(page.getByLabel('Finish workout')).toBeVisible();
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
    await expect(planOptions.getByRole('button', { name: 'Add routine' }).locator('svg')).toHaveCount(2);
    await expect(planOptions.getByRole('button', { name: 'Delete plan' }).locator('svg')).toHaveCount(1);
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

  test('uses the shared action sheet for persisted routine-editor overflow actions', async ({ page }) => {
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
    await expect(routineOptions.getByRole('button', { name: 'Move to a plan' }).locator('svg')).toHaveCount(2);
    await expect(routineOptions.getByRole('button', { name: 'Delete routine' }).locator('svg')).toHaveCount(1);
    await page.getByRole('button', { name: 'Move to a plan' }).click();
    await expect(routineOptions).toHaveCount(0);
    await expect(page.getByText('Part of New plan', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Save routine' }).click();
  });

  test('adds, edits, and removes routine attributes in the local editor draft', async ({ page }) => {
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
    await page.getByRole('button', { name: 'Save routine' }).click();
    await expect(page.getByText('Attributes routine', { exact: true })).toBeVisible();
  });

  test('uses the Live Workout exercise picker and supports opening and swiping routine exercises', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Plans' }).click();
    await page.getByRole('button', { name: 'Create workout, routine, or plan' }).click();
    await page
      .getByTestId('plans-creation-popover')
      .getByRole('button', { name: 'New routine' })
      .click();
    await page.getByLabel('Routine name').fill('Exercise routine');
    await page.getByRole('button', { name: 'Add exercises to routine' }).click();
    await page.getByRole('button', { name: 'Bench Press, 4 variations', exact: true }).click();
    await page.getByRole('button', { name: 'Barbell, 2 variations', exact: true }).click();
    await page
      .getByRole('checkbox', { name: 'Bench Press, Barbell, Standard' })
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
    await expect(exercise.getByRole('button', { name: 'More options for Barbell Bench Press' })).toHaveCount(0);
    await expandExercise.click();
    const collapseExercise = exercise.getByRole('button', { name: 'Collapse Barbell Bench Press' });
    await expect(collapseExercise.locator('svg').last()).toBeVisible();
    await expect(exercise.getByRole('checkbox')).toHaveCount(0);
    const [exerciseNameBox, setCountBox] = await Promise.all([
      exercise.getByText('Barbell Bench Press', { exact: true }).boundingBox(),
      exercise.getByText('1 set', { exact: true }).boundingBox(),
    ]);
    expect((setCountBox?.y ?? 0) - (exerciseNameBox?.y ?? 0)).toBeLessThan(30);
    await expect(exercise.getByRole('button', { name: 'Add set to Barbell Bench Press' })).toBeVisible();
    await swipeLeftFrom(page, exercise);
    await expect(exercise.getByRole('button', { name: 'Delete Barbell Bench Press' })).toBeVisible();
    await swipeRightFrom(page, exercise);
    await expect(exercise.getByText('Barbell Bench Press', { exact: true })).toBeVisible();
  });

  test('attaches a plan routine only after Save and uses a compact plan header', async ({ page }) => {
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
    await page.getByRole('button', { name: 'Routine actions for Plan draft' }).click();
    const routineActions = page.getByTestId('plans-options-sheet');
    await expect(routineActions.getByRole('button', { name: 'Visualize' })).toBeVisible();
    await expect(routineActions.getByRole('button', { name: 'Edit' })).toBeVisible();
    await expect(routineActions.getByRole('button', { name: 'Start' })).toBeVisible();
  });
});
