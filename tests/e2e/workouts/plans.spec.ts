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

async function dragBelow(
  page: import('@playwright/test').Page,
  handleName: string,
  targetName: string,
  onHeld?: () => Promise<void>,
) {
  const handle = page.getByRole('button', { name: handleName });
  const target = page.getByRole('button', { name: targetName });
  const handleBox = await handle.boundingBox();
  const targetBox = await target.boundingBox();
  if (!handleBox || !targetBox) throw new Error('Expected measurable drag targets');

  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;
  const endY = targetBox.y + targetBox.height + 24;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.waitForTimeout(180);
  for (let step = 1; step <= 20; step += 1) {
    await page.mouse.move(startX, startY + ((endY - startY) * step) / 20);
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(120);
  await onHeld?.();
  await page.mouse.up();
  await page.waitForTimeout(600);
}

// The Routine name field is a controlled input that silently reverts a
// programmatic `.fill()` on this build, leaving the Save button disabled. Real
// keystrokes commit through the controlled value, so type name changes with
// select-all + delete + pressSequentially rather than `.fill()`.
async function typeRoutineName(
  page: import('@playwright/test').Page,
  value: string,
) {
  const field = page.getByLabel('Routine name');
  await field.click();
  await field.press('ControlOrMeta+a');
  await field.press('Backspace');
  await field.pressSequentially(value);
  await expect(field).toHaveValue(value);
}

// The exercise picker opens scoped to the active workout/routine type (e.g.
// Strength). Cardio exercises like Elliptical are hidden until that initial
// type scope is cleared through the Filters sheet.
async function clearInitialWorkoutTypeScope(
  page: import('@playwright/test').Page,
) {
  await page.getByRole('button', { name: /^Filters/ }).click();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByRole('button', { name: 'Apply filters' }).click();
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

  test('keeps routine and plan actions behind visible controls outside edit mode', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Plans' }).click();
    await page.getByRole('button', { name: 'Create workout, routine, or plan' }).click();
    await page
      .getByTestId('plans-creation-popover')
      .getByRole('button', { name: 'New routine' })
      .click();
    await typeRoutineName(page, 'Options routine');
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
    // Scope to the editor header: "New routine" also names the still-mounted
    // creation-popover action button, so an unscoped text match is ambiguous.
    await expect(
      page.locator(
        'xpath=//div[normalize-space(text())="New routine" and not(ancestor::*[@data-testid="plans-creation-popover"])]',
      ),
    ).toBeVisible();
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
    await typeRoutineName(page, 'Upper body');
    await expect(page.getByRole('button', { name: 'Start Upper body' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Save routine' }).click();
    await expect(page.getByText('Upper body')).toBeVisible();
    await page.getByRole('button', { name: 'Routine actions for Upper body' }).click();
    const routineActions = page.getByTestId('plans-options-sheet');
    await expect(routineActions.getByText('Upper body', { exact: true })).toBeVisible();
    // Outside edit mode the popup is the quick-use set.
    for (const label of ['Start', 'Visualize', 'Edit']) {
      await expect(routineActions.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
    await expect(routineActions.getByRole('button', { name: 'Duplicate', exact: true })).toHaveCount(0);
    await routineActions.getByRole('button', { name: 'Edit' }).click();
    await expect(routineActions).toHaveCount(0);
    await typeRoutineName(page, 'Upper body updated');
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
    await typeRoutineName(page, 'Recovery routine');
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
    await typeRoutineName(page, 'Discarded routine');
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
    // Add routine and rename both live in edit mode; the resting card is a clean label.
    await expect(page.getByRole('button', { name: 'Add routine to New plan' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Rename New plan' })).toHaveCount(0);

    // Swipe-to-delete is reserved for edit mode: no destructive control at rest.
    await expect(page.getByRole('button', { name: 'Delete Swipe routine' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Delete New plan' })).toHaveCount(0);

    // Edit mode reveals rename, add-routine and swipe-delete affordances, hides create.
    // The swipe gesture itself is exercised on device; here we assert it is wired.
    await page.getByRole('button', { name: 'Edit plans' }).click();
    await expect(page.getByRole('button', { name: 'Create workout, routine, or plan' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add routine to New plan' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rename New plan' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete Swipe routine' })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Delete New plan' })).toHaveCount(1);
  });

  test('reorders standalone and plan routines without dropping any routine', async ({
    page,
  }, testInfo) => {
    await page.addInitScript(() => {
      const now = Date.now();
      localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance: 'dark' }));
      const routine = (id: string, name: string, planId?: string) => ({
        id,
        name,
        type: 'Strength',
        exercises: [],
        planId,
        createdAt: now,
        updatedAt: now,
      });
      localStorage.setItem('@forge/plans-v1', JSON.stringify({
        plans: [{
          id: 'push',
          name: 'Push',
          createdAt: now,
          updatedAt: now,
          routines: [routine('shoulder', 'Shoulder', 'push'), routine('chest', 'Chest', 'push')],
        }],
        standaloneRoutines: [routine('mobility', 'Mobility'), routine('cardio', 'Cardio')],
      }));
    });

    await page.goto('/');
    await page.getByRole('tab', { name: 'Plans' }).click();
    await page.getByRole('button', { name: 'Edit plans' }).click();

    const standaloneCard = page.getByTestId('standalone-routines-card');
    const planCard = page.getByTestId('plan-card-push');
    const standaloneCardBefore = await standaloneCard.boundingBox();
    const planCardBefore = await planCard.boundingBox();
    if (!standaloneCardBefore || !planCardBefore) throw new Error('Expected measurable routine cards');
    const assertStableCardGeometry = async () => {
      const standaloneCardActive = await standaloneCard.boundingBox();
      const planCardActive = await planCard.boundingBox();
      expect(standaloneCardActive?.height).toBeCloseTo(standaloneCardBefore.height, 0);
      expect(planCardActive?.height).toBeCloseTo(planCardBefore.height, 0);
      for (const routineName of ['Mobility', 'Cardio', 'Shoulder', 'Chest']) {
        await expect(page.getByRole('button', { name: `Routine actions for ${routineName}` })).toBeVisible();
      }
    };

    await dragBelow(page, 'Reorder Mobility', 'Routine actions for Cardio', assertStableCardGeometry);
    await dragBelow(
      page,
      'Reorder Shoulder',
      'Routine actions for Chest',
      async () => {
        await assertStableCardGeometry();
        if (testInfo.project.use.isMobile === true) {
            await page.screenshot({ path: testInfo.outputPath('plans-active-routine-drag.png') });
        }
      },
    );

    await expect(page.getByRole('button', { name: /^Routine actions for / })).toHaveCount(4);
    const order = await page.evaluate(() => {
      const raw = localStorage.getItem('@forge/plans-v1');
      const state = raw ? JSON.parse(raw) : null;
      return {
        standalone: state?.standaloneRoutines?.map((item: { name: string }) => item.name),
        plan: state?.plans?.[0]?.routines?.map((item: { name: string }) => item.name),
      };
    });
    expect(order).toEqual({ standalone: ['Cardio', 'Mobility'], plan: ['Chest', 'Shoulder'] });

    const mobilityRail = page.getByRole('button', { name: 'Reorder Mobility' });
    await swipeLeftFrom(page, mobilityRail);
    const deleteMobility = page.getByRole('button', { name: 'Delete Mobility' });
    await expect(deleteMobility).toBeVisible();
    const deleteBox = await deleteMobility.boundingBox();
    expect(deleteBox?.width).toBeGreaterThanOrEqual(56);
    expect(deleteBox?.height).toBeGreaterThanOrEqual(56);
    const standaloneCardRevealed = await standaloneCard.boundingBox();
    if (!deleteBox || !standaloneCardRevealed) throw new Error('Expected measurable Delete reveal');
    expect(standaloneCardRevealed.x + standaloneCardRevealed.width - deleteBox.x - deleteBox.width)
      .toBeLessThanOrEqual(5);
    for (const routineName of ['Mobility', 'Cardio', 'Shoulder', 'Chest']) {
      await expect(page.getByRole('button', { name: `Routine actions for ${routineName}` })).toBeVisible();
    }
    if (testInfo.project.use.isMobile === true) {
      await page.screenshot({ path: testInfo.outputPath('plans-routine-delete-revealed.png') });
    }

    if (testInfo.project.use.isMobile === true) {
      await page.screenshot({ path: testInfo.outputPath('plans-reordered-edit-mode.png') });
    }
  });

  test('confirms before deleting a routine and cancels without removing it', async ({ page }) => {
    await page.addInitScript(() => {
      const now = Date.now();
      localStorage.setItem('@forge/plans-v1', JSON.stringify({
        plans: [],
        standaloneRoutines: [{
          id: 'del-routine',
          name: 'Warmup',
          type: 'Strength',
          exercises: [],
          createdAt: now,
          updatedAt: now,
        }],
      }));
    });
    await page.goto('/');
    await page.getByRole('tab', { name: 'Plans' }).click();
    await page.getByRole('button', { name: 'Edit plans' }).click();

    // Swipe reveals Delete; tapping it must ask before removing anything. The
    // reveal stays open behind the confirmation (force click bypasses a
    // web-only actionability quirk where the translated content over the inset
    // button trips Playwright's hit-test; the button is on top on native).
    await swipeLeftFrom(page, page.getByRole('button', { name: 'Reorder Warmup' }));
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Delete Warmup' }).click({ force: true });
    const confirm = page.getByTestId('plans-delete-routine-confirm');
    await expect(confirm).toBeVisible();

    // Cancel keeps the routine and dismisses the confirmation.
    await confirm.getByRole('button', { name: 'Cancel' }).click();
    await expect(confirm).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Routine actions for Warmup' })).toBeVisible();
    await page.waitForTimeout(400);

    // Confirming actually deletes it.
    await swipeLeftFrom(page, page.getByRole('button', { name: 'Reorder Warmup' }));
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Delete Warmup' }).click({ force: true });
    await page.getByTestId('plans-delete-routine-confirm').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('button', { name: 'Routine actions for Warmup' })).toHaveCount(0);
    const remaining = await page.evaluate(() => {
      const raw = localStorage.getItem('@forge/plans-v1');
      return raw ? JSON.parse(raw).standaloneRoutines.length : -1;
    });
    expect(remaining).toBe(0);
  });

  test('shows the modify options popup when a routine is tapped in edit mode', async ({ page }) => {
    await page.addInitScript(() => {
      const now = Date.now();
      localStorage.setItem('@forge/plans-v1', JSON.stringify({
        plans: [{ id: 'push', name: 'Push', createdAt: now, updatedAt: now, routines: [] }],
        standaloneRoutines: [{
          id: 'del-routine',
          name: 'Warmup',
          type: 'Strength',
          exercises: [],
          createdAt: now,
          updatedAt: now,
        }],
      }));
    });
    await page.goto('/');
    await page.getByRole('tab', { name: 'Plans' }).click();
    await page.getByRole('button', { name: 'Edit plans' }).click();

    await page.getByRole('button', { name: 'Routine actions for Warmup' }).click();
    const sheet = page.getByTestId('plans-options-sheet');
    // Edit mode shows the modify set (a plan exists, so Move to… appears too).
    for (const label of ['Move to…', 'Edit', 'Duplicate', 'Delete']) {
      await expect(sheet.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
    // The quick-use actions are not in the edit-mode popup.
    await expect(sheet.getByRole('button', { name: 'Start', exact: true })).toHaveCount(0);
    await expect(sheet.getByRole('button', { name: 'Visualize', exact: true })).toHaveCount(0);

    // Delete from the popup routes through the shared confirmation.
    await sheet.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByTestId('plans-delete-routine-confirm')).toBeVisible();
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
    await typeRoutineName(page, 'Move routine');
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
    await typeRoutineName(page, 'Attributes routine');
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
    await typeRoutineName(page, 'Attributes routine');
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
    await typeRoutineName(page, 'Attribute template');
    await page.getByRole('button', { name: 'Add attribute' }).click();
    await page.getByLabel('Attribute label').fill('Mood');
    await page.getByLabel('Attribute value').fill('Template value');
    await page.getByRole('button', { name: 'Save attribute' }).click();
    await page.getByRole('button', { name: 'Add attribute' }).click();
    await page.getByLabel('Attribute label').fill('Location');
    await page.getByRole('button', { name: 'Save attribute' }).click();
    // Re-focus the virtualized header field before saving on compact web profiles.
    await typeRoutineName(page, 'Attribute template');
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
    await expect(liveWorkoutList.getByText('Exercises', { exact: true })).toHaveCount(0);
    await page.waitForTimeout(220);
    await page.screenshot({ path: testInfo.outputPath('live-workout-attributes-compact.png') });
    await mood.fill('Focused');
    await expect(mood).toHaveValue('Focused');
    await location.fill('Home gym');
    await expect(location).toHaveValue('Home gym');
    await page.getByRole('button', { name: 'Add exercise' }).click();
    // Elliptical is cardio; drop the Strength scope and search so it renders.
    await clearInitialWorkoutTypeScope(page);
    await page.getByRole('textbox', { name: 'Search exercises' }).fill('Elliptical');
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
    await typeRoutineName(page, 'Exercise routine');
    await page.getByRole('button', { name: 'Add exercises to routine' }).click();
    // The catalogue is windowed; search so the Bench Press group renders.
    await page.getByRole('textbox', { name: 'Search exercises' }).fill('Bench Press');
    await page.getByRole('button', { name: 'Bench Press & 3 variations', exact: true }).click();
    await page
      .getByRole('checkbox', { name: 'Bench Press, Barbell', exact: true })
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
    // The routine editor exposes a per-exercise overflow menu while editing.
    await expect(
      exercise.getByRole('button', { name: 'More options for Barbell Bench Press' }),
    ).toBeVisible();
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
    await typeRoutineName(page, 'Intervals routine');
    await page.getByRole('button', { name: 'Add exercises to routine' }).click();
    // Elliptical is cardio; drop the Strength scope and search so it renders.
    await clearInitialWorkoutTypeScope(page);
    await page.getByRole('textbox', { name: 'Search exercises' }).fill('Elliptical');
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
    await typeRoutineName(page, 'Read-only routine');
    await page.getByRole('button', { name: 'Add exercises to routine' }).click();
    // The catalogue is windowed; search so the Bench Press group renders.
    await page.getByRole('textbox', { name: 'Search exercises' }).fill('Bench Press');
    await page.getByRole('button', { name: 'Bench Press & 3 variations', exact: true }).click();
    await page
      .getByRole('checkbox', { name: 'Bench Press, Barbell', exact: true })
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
    // Rows carry a hairline divider except the last, which ends the card cleanly.
    // Scope to the set rows themselves, not the nested completion-check testid.
    await expect(page.getByTestId(/^workout-details-set-routine-set-/).last()).toHaveCSS(
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
    // The resting plan card is a compact label: name plus routine count, with no
    // inline rename or add-routine controls (those are edit-mode only).
    await expect(page.getByText('New plan', { exact: true })).toBeVisible();
    await expect(page.getByText('0 routines', { exact: true })).toBeVisible();
    await expect(page.getByTestId(/^plan-header-/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add routine to New plan' })).toHaveCount(0);

    // Edit mode reveals the rename pencil (plan-header) and the add-routine
    // control; a routine attaches to the plan only after Save.
    await page.getByRole('button', { name: 'Edit plans' }).click();
    await expect(page.getByTestId(/^plan-header-/)).toHaveCount(1);
    await page.getByRole('button', { name: 'Add routine to New plan' }).click();
    await typeRoutineName(page, 'Plan draft');
    await expect(page.getByRole('button', { name: 'Start Plan draft' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Save routine' }).click();
    await expect(page.getByText('Plan draft', { exact: true })).toBeVisible();

    // Leave edit mode to reach the routine's options entry point.
    await page.getByRole('button', { name: 'Done editing plans' }).click();
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
