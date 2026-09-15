import { expect, test, type Locator, type Page } from '@playwright/test';

async function startEmptyWorkoutWithExercise(page: Page): Promise<void> {
  await page.goto('/');
  await startBlankWorkout(page);
  await page.getByRole('button', { name: 'Add exercise' }).click();
  await expect(page.getByTestId('add-exercise-catalogue')).toBeVisible();
  // The picker deliberately enters after its card has measured. Wait for that
  // short Forge transition before exercising a row rather than dispatching a
  // press while the sheet is still below its resting position.
  await page.waitForTimeout(260);
  await selectStandardBarbellBenchPress(page);
  await page.getByRole('button', { name: 'Confirm selected exercises' }).click();
}

async function selectStandardBarbellBenchPress(page: Page): Promise<void> {
  await page.getByLabel('Search exercises').fill('barbell bench press');
  const variation = page.getByRole('checkbox', { name: 'Bench Press, variation' });
  await variation.click();
}

async function revealCatalogueItem(page: Page, locator: Locator): Promise<void> {
  const catalogue = page.getByTestId('add-exercise-catalogue');
  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (await locator.count()) {
      await expect(locator).toBeVisible();
      return;
    }
    await scrollCatalogueUp(page);
    await page.waitForTimeout(40);
  }
  await expect(locator).toBeVisible();
}

async function catalogueScrollMetrics(page: Page): Promise<{ scrollTop: number; x: number; y: number; width: number; height: number }> {
  const catalogue = page.getByTestId('add-exercise-catalogue');
  return catalogue.evaluate((element) => {
    const nodes: HTMLElement[] = [element as HTMLElement, ...Array.from(element.querySelectorAll<HTMLElement>('*'))];
    for (let parent = element.parentElement; parent; parent = parent.parentElement) nodes.push(parent);
    const scroller = nodes.find((node) => {
      const style = window.getComputedStyle(node);
      return node.scrollHeight > node.clientHeight + 24 && /auto|scroll/.test(style.overflowY);
    });
    if (!scroller) throw new Error('Expected the add-exercise catalogue to expose a vertical scroll container');
    const rect = scroller.getBoundingClientRect();
    return { scrollTop: scroller.scrollTop, x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
}

async function scrollCatalogueUp(page: Page): Promise<void> {
  const catalogue = page.getByTestId('add-exercise-catalogue');
  const before = await catalogueScrollMetrics(page);
  const after = await catalogue.evaluate((element) => {
    const nodes: HTMLElement[] = [element as HTMLElement, ...Array.from(element.querySelectorAll<HTMLElement>('*'))];
    for (let parent = element.parentElement; parent; parent = parent.parentElement) nodes.push(parent);
    const scroller = nodes.find((node) => {
      const style = window.getComputedStyle(node);
      return node.scrollHeight > node.clientHeight + 24 && /auto|scroll/.test(style.overflowY);
    });
    if (!scroller) throw new Error('Expected the add-exercise catalogue to expose a vertical scroll container');
    scroller.scrollBy({ top: Math.max(180, scroller.clientHeight * 0.62) });
    return scroller.scrollTop;
  });
  expect(after).toBeGreaterThan(before.scrollTop + 24);
}

async function startBlankWorkout(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Start workout' }).click();
  await page.getByTestId('dashboard-workout-source-chooser').getByRole('button', { name: 'Blank workout' }).click();
  await expect(page.getByTestId('add-exercise-catalogue')).toBeVisible();
  await page.getByTestId('add-exercise-sheet-surface').getByRole('button', { name: 'Close add exercises' }).click();
  await expect(page.getByTestId('add-exercise-sheet-surface')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add exercise', exact: true })).toBeVisible();
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
  test('edits a live workout as a full-screen draft', async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await startBlankWorkout(page);
    await expect(page.getByRole('button', { name: 'Edit live workout' })).toBeVisible();
    await page.getByRole('button', { name: 'Edit live workout' }).click();
    await expect(page.getByRole('button', { name: 'Cancel editing workout' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save workout' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Select Date' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Select Start time' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Select End time' })).toHaveCount(0);
    await page.getByLabel('Workout name').fill('Upper body');
    await page.getByRole('button', { name: 'Choose workout type' }).click();
    await page.screenshot({ path: testInfo.outputPath('live-workout-type-picker-selected.png') });
    await page.getByRole('radio', { name: 'Cardio' }).click();
    const workoutNote = page.getByLabel('Notes');
    await workoutNote.fill('Easy pace');
    await page.getByRole('button', { name: 'Add attribute' }).click();
    await expect(page.getByRole('button', { name: 'Close Add attribute' })).toHaveCount(0);
    await page.getByLabel('Attribute label').fill('Mood');
    await page.getByLabel('Attribute value').fill('Focused');
    await page.getByRole('button', { name: 'Choose attribute icon' }).click();
    await expect(page.getByRole('radio', { name: 'Use location icon' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Use hydration icon' })).toBeVisible();
    await page.getByRole('radio', { name: 'Use mood icon' }).click();
    await page.getByRole('button', { name: 'Save attribute' }).click();
    await page.getByRole('button', { name: 'Add attribute' }).click();
    await page.getByLabel('Attribute label').fill('Location');
    await page.getByLabel('Attribute value').fill('Home gym');
    await page.getByRole('button', { name: 'Save attribute' }).click();
    await expect(page.getByRole('button', { name: 'Edit Mood attribute' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit Location attribute' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('live-workout-editor-grouped-attributes-dark.png') });
    await page.getByRole('button', { name: 'Edit Location attribute' }).click();
    await expect(page.getByRole('button', { name: 'Remove attribute' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close Edit attribute' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Back to edit workout' }).click();
    await expect(page.getByRole('button', { name: 'Edit Location attribute' })).toBeVisible();
    await swipeLeftFrom(page, page.getByRole('button', { name: 'Edit Location attribute' }));
    await expect(page.getByRole('button', { name: 'Delete Location attribute' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete Location attribute' }).click();
    await expect(page.getByRole('button', { name: 'Edit Location attribute' })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('live-workout-editor-dark.png') });
    await page.getByRole('button', { name: 'Save workout' }).click();
    await expect(page.getByText('Upper body', { exact: true })).toBeVisible();
  });

  test('reorders an active-workout draft and confirms before discarding it', async ({ page }, testInfo) => {
    await page.goto('/');
    await startBlankWorkout(page);
    await page.getByTestId('active-workout-list').getByRole('button', { name: 'Add exercise' }).click();
    await selectStandardBarbellBenchPress(page);
    await page.getByLabel('Search exercises').fill('barbell back squat');
    await page.getByRole('checkbox').first().click({ force: true });
    await page.getByRole('button', { name: 'Confirm selected exercises' }).click();

    await page.getByRole('button', { name: 'Edit live workout' }).click();
    await expect(page.getByRole('button', { name: 'Expand Barbell Bench Press' })).toBeVisible();
    await expect(page.getByLabel('Weight for set 1')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'More options for Barbell Bench Press' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Expand Barbell Bench Press' }).click();
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    await page.getByRole('button', { name: 'Collapse Barbell Bench Press' }).click();
    const handles = page.getByRole('button', { name: /Drag to reorder/ });
    await expect(handles).toHaveCount(2);
    const [firstHandle, secondHandle] = await Promise.all([
      handles.nth(0).boundingBox(),
      handles.nth(1).boundingBox(),
    ]);
    if (!firstHandle || !secondHandle) throw new Error('Expected both active-workout drag handles');
    await page.mouse.move(firstHandle.x + firstHandle.width / 2, firstHandle.y + firstHandle.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(240);
    await page.mouse.move(secondHandle.x + secondHandle.width / 2, secondHandle.y + secondHandle.height / 2 + 28, { steps: 12 });
    if (testInfo.project.name === 'iphone-air') {
      await page.screenshot({ path: testInfo.outputPath('live-workout-editor-reorder-iphone.png') });
    }
    await page.mouse.up();
    await expect(page.getByRole('button', { name: 'Save workout' })).toBeEnabled();
    await page.getByRole('button', { name: 'Save workout' }).click();

    const [squat, bench] = await Promise.all([
      page.getByText('Barbell Back Squat', { exact: true }).boundingBox(),
      page.getByText('Barbell Bench Press', { exact: true }).boundingBox(),
    ]);
    expect(squat?.y).toBeLessThan(bench?.y ?? Number.POSITIVE_INFINITY);

    await page.getByRole('button', { name: 'Edit live workout' }).click();
    await page.getByLabel('Workout name').fill('Discarded live edit');
    await page.getByRole('button', { name: 'Cancel editing workout' }).click();
    const confirmation = page.getByTestId('discard-active-workout-editor-confirmation');
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: 'Keep editing' }).click();
    await expect(page.getByLabel('Workout name')).toHaveValue('Discarded live edit');
    await page.getByRole('button', { name: 'Cancel editing workout' }).click();
    await confirmation.getByRole('button', { name: 'Discard changes' }).click();
    await expect(page.getByText('Discarded live edit', { exact: true })).toHaveCount(0);
  });

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
    await selectStandardBarbellBenchPress(page);
    await page.getByRole('button', { name: 'Confirm selected exercises' }).click();

    await expect(page.getByText('Barbell Bench Press', { exact: true })).toBeVisible();
    await expect(page.getByText('Flat · Barbell', { exact: true })).toBeVisible();
    await expect(page.getByLabel(/^Kg for set/)).toHaveCount(3);
    await page.getByLabel('Kg for set 1').fill('60');
    await page.getByLabel('Reps for set 1').fill('8');
    await page.getByLabel('Complete set 1').click();

    await page.getByRole('button', { name: 'Finish workout' }).click();
    await expect(page.getByTestId('finish-workout-confirmation')).toBeVisible();
    await page.getByTestId('finish-workout-confirmation').getByRole('button', { name: 'Finish workout' }).click();
    await expect(page.getByTestId('dashboard-header-title').last()).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Workout', exact: true })).toHaveCount(0);
  });

  test('groups exercise variations and selects single-variation exercises directly', async ({
    page,
  }) => {
    await page.goto('/');
    await startBlankWorkout(page);
    await page.getByRole('button', { name: 'Add exercise' }).click();

    const search = page.getByLabel('Search exercises');
    const benchPress = page.getByRole('button', { name: 'Bench Press & 3 variations', exact: true });
    await revealCatalogueItem(page, benchPress);
    await expect(page.getByText('Chest', { exact: true })).toBeVisible();
    await expect(page.getByText('Chest · 12', { exact: true })).toHaveCount(0);
    await expect(
      benchPress,
    ).toBeVisible();

    await search.fill('pec');
    await expect(page.getByRole('button', { name: 'Clear exercise search' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear exercise search' }).click();
    await expect(search).toHaveValue('');

    await search.fill('pec deck');
    const pecDeck = page.getByRole('checkbox', { name: 'Chest Fly, variation' });
    await revealCatalogueItem(page, pecDeck);
    await pecDeck.click();
    await expect(page.getByText('Add exercises (1)', { exact: true })).toBeVisible();

    await search.fill('bench press');
    await revealCatalogueItem(page, benchPress);
    await benchPress.click();
    await expect(page.getByRole('checkbox')).toHaveCount(5);
  });

  test('distinguishes assisted machine movements and avoids repeating variation metadata', async ({ page }, testInfo) => {
    await page.goto('/');
    await startBlankWorkout(page);
    await page.getByRole('button', { name: 'Add exercise' }).click();

    const search = page.getByLabel('Search exercises');
    await search.fill('dip');
    const dip = page.getByRole('button', { name: 'Dip & 4 variations', exact: true });
    await revealCatalogueItem(page, dip);
    await dip.click();
    await expect(page.getByRole('checkbox', { name: 'Dip, Machine · Assisted' })).toBeVisible();

    await search.fill('weighted dip');
    await page.getByRole('checkbox', { name: 'Dip, variation' }).click({ force: true });
    await page.getByRole('button', { name: 'Confirm selected exercises' }).click();
    await expect(page.getByText('Weighted Dip', { exact: true })).toBeVisible();
    await expect(page.getByText('Dip Bars', { exact: true })).toBeVisible();
    await expect(page.getByText('Weighted · Dip Bars', { exact: true })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('weighted-dip-metadata.png'), fullPage: true });
  });

  test('keeps the picker open and exposes selectable exercises after catalogue scrolling', async ({ page }) => {
    await page.goto('/');
    await startBlankWorkout(page);
    await page.getByRole('button', { name: 'Add exercise' }).click();

    const picker = page.getByTestId('add-exercise-sheet-surface');
    await scrollCatalogueUp(page);

    await expect(picker).toBeVisible();
    const revealedSelection = page.getByTestId('add-exercise-catalogue').getByRole('checkbox').first();
    await expect(revealedSelection).toBeVisible();
    await revealedSelection.click();
    await expect(page.getByText('Add exercises (1)', { exact: true })).toBeVisible();
  });

  test('opens the pre-derived Add Exercises catalogue promptly', async ({ page }, testInfo) => {
    await page.goto('/');
    await startBlankWorkout(page);
    const picker = page.getByTestId('add-exercise-sheet-surface');
    await page.evaluate(() => performance.mark('add-exercise-open'));
    await page.getByRole('button', { name: 'Add exercise' }).click();
    const pickerReadyMs = await page.evaluate(async () => {
      const openedAt = performance.getEntriesByName('add-exercise-open').at(-1)?.startTime ?? performance.now();
      return new Promise<number>((resolve, reject) => {
        const deadline = performance.now() + 1_500;
        const check = () => {
          const surface = document.querySelector('[data-testid="add-exercise-sheet-surface"]');
          const search = document.querySelector('[aria-label="Search exercises"]') as HTMLInputElement | null;
          const settled = surface && surface.getBoundingClientRect().y < window.innerHeight * 0.1 + 8;
          const usable = Boolean(search && !search.disabled && surface && surface.querySelectorAll('[role="button"]').length > 3);
          if (settled && usable) return resolve(performance.now() - openedAt);
          if (performance.now() >= deadline) return reject(new Error('The Add Exercises picker did not become settled and usable.'));
          requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
      });
    });
    expect(pickerReadyMs).toBeLessThanOrEqual(600);
    await expect(picker).toBeVisible();
    await expect(page.getByLabel('Search exercises')).toBeEditable();
    await page.waitForTimeout(220);
    await page.screenshot({ path: testInfo.outputPath('add-exercises-catalogue-ready.png') });
  });

  test('stages Live Workout filters without losing selected exercises', async ({ page }, testInfo) => {
    await page.goto('/');
    await startBlankWorkout(page);
    await page.getByRole('button', { name: 'Add exercise' }).click();
    await page.getByLabel('Search exercises').fill('elliptical');
    const elliptical = page.getByRole('checkbox', { name: 'Elliptical, variation' });
    await elliptical.click();
    await expect(page.getByText('Add exercises (1)', { exact: true })).toBeVisible();

    const addExerciseSheet = page.getByTestId('add-exercise-sheet-surface');
    await expect(addExerciseSheet).toHaveCount(1);
    await page.mouse.move(196, 450);
    await page.mouse.down();
    await page.mouse.move(196, 790, { steps: 10 });
    await page.mouse.up();
    await expect(addExerciseSheet).toHaveCount(1);
    const addCloseBox = await addExerciseSheet
      .getByRole('button', { name: 'Close add exercises' })
      .boundingBox();
    await page.getByRole('button', { name: 'Filters' }).click();
    const apply = page.getByRole('button', { name: 'Apply filters' });
    await expect(apply).toBeVisible();
    await expect(apply).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toHaveCount(0);
    await expect(addExerciseSheet).toHaveCount(1);
    const filterClose = page.getByRole('button', { name: 'Cancel exercise filters' });
    const filterCloseBox = await filterClose.boundingBox();
    expect(filterCloseBox?.x ?? Infinity).toBeCloseTo(addCloseBox?.x ?? -Infinity, 0);
    expect(filterCloseBox?.y ?? Infinity).toBeCloseTo(addCloseBox?.y ?? -Infinity, 0);
    const applyBox = await apply.boundingBox();
    expect((page.viewportSize()?.height ?? Infinity) - ((applyBox?.y ?? 0) + (applyBox?.height ?? 0))).toBeLessThanOrEqual(24);
    await page.screenshot({ path: testInfo.outputPath('live-workout-filter-sheet.png') });
    await page.getByRole('button', { name: 'Edit Equipment filter, Any' }).click();
    await page.getByRole('checkbox', { name: 'Filter Equipment: Machine' }).click();
    await expect(page.getByRole('button', { name: 'Apply (1)' })).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath('live-workout-filter-apply-selected.png') });
    await filterClose.click();
    await expect(page.getByLabel('Filters')).toBeVisible();
    await expect(addExerciseSheet).toHaveCount(1);

    await page.getByRole('button', { name: 'Filters' }).click();
    await page.getByRole('button', { name: 'Edit Equipment filter, Any' }).click();
    await page.getByRole('checkbox', { name: 'Filter Equipment: Machine' }).click();
    await page.getByRole('button', { name: 'Back to filters' }).click();
    await page.getByRole('button', { name: 'Edit Category filter, Any' }).click();
    await page.getByRole('checkbox', { name: 'Filter Category: Chest' }).click();
    await page.getByRole('button', { name: 'Apply (2)' }).click();
    await expect(page.getByLabel('Filters, 2 active')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove Machine filter' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Clear all filters' })).toHaveCount(0);
    await expect(page.getByText('Add exercises (1)', { exact: true })).toBeVisible();
  });

  test('dismisses Add Exercises from its full header drag zone, not its scrolling catalogue', async ({ page }) => {
    await page.goto('/');
    await startBlankWorkout(page);
    await page.getByRole('button', { name: 'Add exercise' }).click();
    const sheet = page.getByTestId('add-exercise-sheet-surface');
    await expect(sheet).toBeVisible();
    await expect.poll(async () => (await sheet.boundingBox())?.y ?? Infinity).toBeLessThan(
      (page.viewportSize()?.height ?? 0) * 0.1 + 8,
    );
    const title = page.getByText('Add exercises', { exact: true }).first();
    const titleBox = await title.boundingBox();
    expect(titleBox).not.toBeNull();
    await page.mouse.move((titleBox?.x ?? 0) + (titleBox?.width ?? 0) / 2, (titleBox?.y ?? 0) + (titleBox?.height ?? 0) / 2);
    await page.mouse.down();
    await page.mouse.move((titleBox?.x ?? 0) + (titleBox?.width ?? 0) / 2, (titleBox?.y ?? 0) + 360, { steps: 12 });
    await page.mouse.up();
    await expect(sheet).toHaveCount(0);
  });

  test('dismisses the entire picker when embedded Filters is dragged down', async ({ page }) => {
    await page.goto('/');
    await startBlankWorkout(page);
    await page.getByRole('button', { name: 'Add exercise' }).click();
    await page.getByRole('button', { name: 'Filters' }).click();
    const title = page.getByText('Filters', { exact: true });
    const titleBox = await title.boundingBox();
    expect(titleBox).not.toBeNull();
    await page.mouse.move((titleBox?.x ?? 0) + (titleBox?.width ?? 0) / 2, (titleBox?.y ?? 0) + (titleBox?.height ?? 0) / 2);
    await page.mouse.down();
    await page.mouse.move((titleBox?.x ?? 0) + (titleBox?.width ?? 0) / 2, (titleBox?.y ?? 0) + 360, { steps: 12 });
    await page.mouse.up();
    await expect(page.getByTestId('add-exercise-sheet-surface')).toHaveCount(0);
  });

  test('keeps variation counts legible in Dark appearance', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await startBlankWorkout(page);
    await page.getByRole('button', { name: 'Add exercise' }).click();
    await page.getByLabel('Search exercises').fill('bench');

    const count = page.getByTestId('exercise-group-count-Bench Press');
    await expect(count).toHaveCSS('background-color', 'rgb(42, 47, 52)');
    await expect(count).toHaveCSS('border-color', 'rgb(58, 64, 70)');
    await expect(count.getByText('0', { exact: true })).toHaveCSS('color', 'rgb(195, 200, 204)');
  });

  test('starts the rest timer from the workout header', async ({ page }, testInfo) => {
    await page.goto('/');
    await startBlankWorkout(page);

    const restTimer = page.getByRole('button', { name: 'Start rest timer' });
    await expect(restTimer).toBeVisible();
    await restTimer.click();
    await expect(page.getByText('Rest timer', { exact: true })).toBeVisible();
    const pickerSheet = page.getByTestId('rest-timer-sheet-surface');
    const pickerHeight = await pickerSheet.boundingBox().then((box) => box?.height ?? 0);
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
    await expect(page.getByRole('tab', { name: 'Workout' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /rest .*remaining/ })).toHaveCount(0);
    await expect(page.getByRole('dialog').getByText(/01:2[0-9]/)).toBeVisible();
    await expect(page.getByText('remaining', { exact: true })).toBeVisible();
    const progress = page.getByTestId('rest-timer-progress-track');
    await expect(progress).toBeVisible();
    await expect.poll(async () => (await page.getByTestId('rest-timer-sheet-surface').boundingBox())?.height ?? Infinity).toBeLessThan(pickerHeight);
    await page.waitForTimeout(350);
    await page.screenshot({ path: testInfo.outputPath('rest-timer-compact.png') });
    const progressFill = page.getByTestId('rest-timer-progress-fill');
    const progressBeforeAdjustment = await progressFill.evaluate((element) => element.getBoundingClientRect().width);
    await page.getByRole('button', { name: 'Increase rest by 10 seconds' }).click();
    await expect.poll(async () => progressFill.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(progressBeforeAdjustment);
    const stopTimer = page.getByRole('button', { name: 'Stop rest timer' });
    await expect(stopTimer).toHaveCSS('background-color', 'rgb(246, 220, 221)');
    await expect(stopTimer).toHaveCSS('border-color', 'rgb(214, 72, 72)');
    await stopTimer.click();
    await expect(page.getByRole('button', { name: 'Start rest timer' }).first()).toBeVisible();
  });

  test('keeps an overdue rest timer visible in destructive red with recovery actions', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-09-12T12:00:00Z') });
    await page.goto('/');
    await startBlankWorkout(page);
    await page.getByRole('button', { name: 'Start rest timer' }).click();
    await page.getByRole('button', { name: 'Start rest timer', exact: true }).last().click();

    await page.clock.fastForward(91_000);

    const timer = page.getByRole('button', { name: /Rest timer, 1 seconds remaining/ });
    await expect(timer).toBeVisible();
    await expect(page.getByText('00:01', { exact: true }).first()).toHaveCSS('color', 'rgb(200, 92, 92)');

    await expect(page.getByText('+00:01', { exact: true })).toHaveCSS('color', 'rgb(200, 92, 92)');
    await expect(page.getByText('rest exceeded', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Extend rest by 10 seconds' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Extend rest by 30 seconds' })).toBeVisible();
  });

  test('opens a compact Workout duration sheet from elapsed time', async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await startBlankWorkout(page);

    await page.getByRole('button', { name: 'Open workout duration' }).click();
    const sheet = page.getByTestId('workout-duration-sheet-surface');
    await expect(sheet).toBeVisible();
    await expect(page.getByText('Workout duration', { exact: true })).toBeVisible();
    await expect(page.getByText('Automatic Time Tracking', { exact: true })).toBeVisible();
    await expect(page.getByText('Keeps track of your workout duration')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Choose workout start date' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Choose workout start time' })).toBeVisible();
    const startDate = page.getByRole('button', { name: 'Choose workout start date' });
    const dateBeforeDraft = await startDate.textContent();
    await startDate.click();
    const datePicker = page.getByTestId('workout-duration-date-picker');
    await expect(datePicker).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('workout-duration-date-picker.png') });
    await datePicker.getByRole('button', { name: 'Next month' }).click();
    await datePicker.getByRole('button', { name: /^Select / }).first().click();
    await page.getByRole('button', { name: 'Back to workout duration' }).click();
    await expect(startDate).toHaveText(dateBeforeDraft ?? '');
    await startDate.click();
    await page.getByTestId('workout-duration-date-picker').getByRole('button', { name: 'Next month' }).click();
    await page.getByTestId('workout-duration-date-picker').getByRole('button', { name: /^Select / }).first().click();
    await page.getByRole('button', { name: 'Save workout start time' }).click();
    await expect(startDate).not.toHaveText(dateBeforeDraft ?? '');
    await page.getByRole('button', { name: 'Choose workout start time' }).click();
    const timePicker = page.getByTestId('workout-duration-time-picker');
    await expect(timePicker).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('workout-duration-time-picker.png') });
    const hourOptions = timePicker.getByTestId('forge-time-hours-wheel').getByRole('radio');
    await expect(hourOptions).toHaveCount(24);
    await hourOptions.nth(0).click();
    const done = page.getByRole('button', { name: 'Save workout start time' });
    await expect(done).toBeVisible();
    await expect(done).toHaveCSS('height', '44px');
    await page.getByRole('button', { name: 'Back to workout duration' }).click();
    const tracking = page.getByRole('switch', { name: 'Automatic Time Tracking' });
    await expect(tracking).toHaveAttribute('aria-checked', 'true');
    await tracking.click();
    await expect(tracking).toHaveAttribute('aria-checked', 'false');
    await tracking.click();
    await expect(tracking).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: 'Reset Start Time' }).click();
    const resetConfirmation = page.getByTestId('reset-start-time-confirmation');
    await expect(resetConfirmation).toBeVisible();
    await resetConfirmation.getByRole('button', { name: 'Reset start time' }).click();
    await expect(resetConfirmation).toBeHidden();
    await expect(sheet).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('workout-duration-compact.png') });
  });

  test('confirms before discarding an active workout', async ({ page }) => {
    await page.goto('/');
    await startBlankWorkout(page);

    await page.getByRole('button', { name: 'Cancel workout' }).click();
    const confirmation = page.getByTestId('discard-live-workout-confirmation');
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: 'Keep working out' }).click();
    await expect(confirmation).toBeHidden();
    await expect(page.getByRole('button', { name: 'Add exercise' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel workout' }).click();
    await confirmation.getByRole('button', { name: 'Discard workout' }).click();
    await expect(page.getByRole('button', { name: 'Start workout' })).toBeVisible();
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
      'rgb(214, 72, 72)',
    );
    await expect(page.getByLabel('Reps for set 1')).toHaveCSS(
      'border-top-color',
      'rgb(214, 72, 72)',
    );
    await page.waitForTimeout(1300);
    await expect(page.getByLabel('Weight for set 1')).not.toHaveCSS(
      'border-top-color',
      'rgb(214, 72, 72)',
    );
    await expect(page.getByLabel('Reps for set 1')).not.toHaveCSS(
      'border-top-color',
      'rgb(214, 72, 72)',
    );

    await page.getByLabel('Weight for set 1').fill('60');
    await expect(page.getByLabel('Weight for set 1')).not.toHaveCSS(
      'border-top-color',
      'rgb(214, 72, 72)',
    );
    await page.getByLabel('Reps for set 1').fill('8');
    await page.getByRole('checkbox', { name: 'Complete set 1' }).click();
    await expect(page.getByRole('checkbox', { name: 'Set 1 completed' })).toBeVisible();
  });

  test('opens set details as a sheet from the set number', async ({ page }, testInfo) => {
    await startEmptyWorkoutWithExercise(page);

    await page.getByLabel('Open details for set 1').click();
    const sheet = page.getByTestId('set-details-sheet');
    await expect(sheet.getByText('Set 1', { exact: true })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Close Set 1' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Delete Set 1' })).toBeVisible();
    await expect(page.getByText('SET KIND', { exact: true })).toBeVisible();
    await expect(page.getByText('SESSION NOTE & EFFORT', { exact: true })).toBeVisible();
    await expect(page.getByText('NEXT SESSION', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Type help' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Next-time target help' })).toHaveCount(0);

    await expect(page.getByRole('radiogroup', { name: 'Set type' })).toHaveCount(0);
    const changeKind = sheet.getByRole('button', { name: 'Change set kind' });
    await expect(page.getByLabel('Set 1 has a next session target')).toHaveCount(0);
    const changeKindBox = await changeKind.boundingBox();
    expect(changeKindBox?.height).toBeGreaterThanOrEqual(43);
    await changeKind.click();
    await expect(sheet.getByText('Set kind', { exact: true })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Back to Set 1' })).toBeVisible();
    const setTypes = sheet.getByRole('radiogroup', { name: 'Set type' });
    await expect(setTypes.getByRole('radio')).toHaveCount(4);
    const warmUpBox = await setTypes.getByRole('radio', { name: 'Warm Up' }).boundingBox();
    expect(warmUpBox?.height).toBeCloseTo(48, 0);
    const dropSet = setTypes.getByRole('radio', { name: 'Drop Set' });
    await expect(dropSet).toHaveAttribute('aria-checked', 'false');
    await dropSet.click();
    await expect(sheet.getByText('Drop Set', { exact: true })).toBeVisible();
    const clearKind = sheet.getByRole('button', { name: 'Clear set kind' });
    await expect(clearKind).toBeVisible();
    await expect(clearKind).toHaveCSS('background-color', 'rgb(246, 220, 221)');
    if (testInfo.project.name === 'iphone-air') {
      await page.screenshot({ path: testInfo.outputPath('set-kind-actions-iphone.png') });
    }
    await changeKind.click();
    await expect(sheet.getByRole('button', { name: 'Back to Set 1' })).toBeVisible();
    await expect(sheet.getByText('SET KIND', { exact: true })).toHaveCount(0);
    await sheet.getByRole('button', { name: 'Back to Set 1' }).click();
    await expect(sheet.getByText('Drop Set', { exact: true })).toBeVisible();
    await sheet.getByRole('button', { name: 'Clear set kind' }).click();
    await expect(sheet.getByText('No type', { exact: true })).toBeVisible();
    if (testInfo.project.name === 'iphone-air') {
      await page.screenshot({ path: testInfo.outputPath('set-editor-iphone.png') });
    }

    const effort = page.getByRole('radiogroup', { name: 'Set effort' });
    await effort.getByRole('radio', { name: 'RPE 8', exact: true }).click();
    await expect(effort.getByRole('radio', { name: 'RPE 8', exact: true })).toHaveAttribute('aria-checked', 'true');
    const [effortScrollBox, selectedRpeBox] = await Promise.all([
      page.getByTestId('set-effort-scroll').boundingBox(),
      effort.getByRole('radio', { name: 'RPE 8', exact: true }).boundingBox(),
    ]);
    if (!effortScrollBox || !selectedRpeBox) throw new Error('Expected horizontal RPE selector geometry');
    expect(selectedRpeBox.height).toBeGreaterThanOrEqual(44);
    expect(Math.abs(selectedRpeBox.x + selectedRpeBox.width / 2 - (effortScrollBox.x + effortScrollBox.width / 2))).toBeLessThanOrEqual(3);
    if (testInfo.project.name === 'iphone-air') {
      await page.screenshot({ path: testInfo.outputPath('set-editor-rpe-iphone.png') });
    }

    const commentBox = await page.getByLabel('Comment for set 1').boundingBox();
    expect(commentBox?.height).toBeGreaterThanOrEqual(80);
    const [sessionCardBox, nextSessionBox] = await Promise.all([
      page.getByTestId('set-session-note-effort-card').boundingBox(),
      page.getByTestId('set-next-session-section').boundingBox(),
    ]);
    if (!sessionCardBox || !nextSessionBox) throw new Error('Expected adjacent editor sections to be measurable');
    expect(nextSessionBox.y - (sessionCardBox.y + sessionCardBox.height)).toBeLessThanOrEqual(8);

    const targetRects = await page
      .locator('input[aria-label^="Next-time"]')
      .evaluateAll((elements) =>
        elements.map((element) => {
          const card = element.parentElement?.parentElement;
          if (!card) throw new Error('Expected target card to be measurable');
          const rect = card.getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        }),
      );
    if (targetRects.length !== 2) throw new Error('Expected two target inputs to be measurable');
    const [firstTarget, secondTarget] = [...targetRects].sort((a, b) => a.y - b.y);
    expect(firstTarget.height).toBeCloseTo(56, 0);
    expect(secondTarget.y).toBeGreaterThanOrEqual(firstTarget.y + 55);
    expect(firstTarget.width).toBeGreaterThanOrEqual(280);
    expect(Math.abs(firstTarget.width - secondTarget.width)).toBeLessThanOrEqual(1);
    await page.getByRole('textbox', { name: 'Next-time kg target for set 1' }).fill('62');
    if (testInfo.project.name === 'iphone-air') {
      await page
        .locator('input[aria-label^="Next-time"]')
        .first()
        .locator('xpath=../../..')
        .screenshot({ path: testInfo.outputPath('set-next-time-target-iphone.png') });
    }

    await sheet.getByRole('button', { name: 'Close Set 1' }).click();
    await expect(page.getByText('SET KIND', { exact: true })).toHaveCount(0);
    const [targetChipBox, targetDotBox, rpeBox] = await Promise.all([
      page.getByTestId('live-set-number-chip-1').boundingBox(),
      page.getByLabel('Set 1 has a next session target').boundingBox(),
      page.getByLabel('Set 1 RPE 8').boundingBox(),
    ]);
    if (!targetChipBox || !targetDotBox || !rpeBox) throw new Error('Expected target and RPE set indicators to be measurable');
    await expect(page.getByLabel('Set 1 has a next session target')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    expect(targetDotBox.x).toBeLessThan(targetChipBox.x + targetChipBox.width / 2);
    expect(targetDotBox.y).toBeLessThan(targetChipBox.y + targetChipBox.height / 2);
    expect(rpeBox.x).toBeLessThan(targetChipBox.x + targetChipBox.width / 2);
    expect(rpeBox.y + rpeBox.height).toBeGreaterThan(targetChipBox.y + targetChipBox.height / 2);

    await page.getByLabel('Open details for set 1').click();
    await page.getByLabel('Comment for set 1').fill('Keep this form');
    await expect(page.getByText('14/120', { exact: true })).toHaveCount(0);
    await page.getByTestId('set-details-sheet').getByRole('button', { name: 'Close Set 1' }).click();
    await expect(page.getByTestId('set-details-sheet')).toHaveCount(0);
    await expect(page.getByText('Keep this form', { exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Set 1 has a comment')).toBeVisible();
    const [chipBox, dotBox] = await Promise.all([
      page.getByTestId('live-set-number-chip-1').boundingBox(),
      page.getByLabel('Set 1 has a comment').boundingBox(),
    ]);
    expect(chipBox).not.toBeNull();
    expect(dotBox).not.toBeNull();
    if (!chipBox || !dotBox) throw new Error('Expected a measurable set chip and comment dot');
    await expect(page.getByLabel('Set 1 has a comment').locator('svg')).toHaveCount(0);
    expect(dotBox.width).toBeCloseTo(7, 0);
    expect(dotBox.height).toBeCloseTo(7, 0);
    expect(dotBox.x).toBeGreaterThan(chipBox.x + chipBox.width / 2);
    expect(dotBox.y).toBeGreaterThan(chipBox.y + chipBox.height / 2);
    expect(dotBox.x).toBeLessThan(chipBox.x + chipBox.width);
    expect(dotBox.y).toBeLessThan(chipBox.y + chipBox.height);
    expect(dotBox.x + dotBox.width).toBeLessThanOrEqual(chipBox.x + chipBox.width);
    expect(dotBox.y + dotBox.height).toBeLessThanOrEqual(chipBox.y + chipBox.height);
    expect(dotBox.x + dotBox.width).toBeGreaterThan(chipBox.x + chipBox.width - 3);
    expect(dotBox.y + dotBox.height).toBeGreaterThan(chipBox.y + chipBox.height - 3);
    if (testInfo.project.name === 'iphone-air') {
      await page.screenshot({ path: testInfo.outputPath('set-comment-indicator-iphone.png') });
    }
  });

  test('inverts a set comment dot in Dark appearance', async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance: 'dark' }));
    });
    await startEmptyWorkoutWithExercise(page);
    await page.getByLabel('Open details for set 1').click();
    await page.getByLabel('Comment for set 1').fill('Keep this form');
    await page.getByTestId('set-details-sheet').getByRole('button', { name: 'Close Set 1' }).click();
    await expect(page.getByTestId('set-details-sheet')).toHaveCount(0);

    const dot = page.getByLabel('Set 1 has a comment');
    await expect(dot).toHaveCSS('background-color', 'rgb(247, 248, 246)');
    if (testInfo.project.name === 'iphone-air') {
      await page.screenshot({ path: testInfo.outputPath('dark-set-comment-indicator-iphone.png') });
    }
  });

  test('keeps a next-session target dot white in Dark appearance', async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance: 'dark' }));
    });
    await startEmptyWorkoutWithExercise(page);
    await page.getByLabel('Open details for set 1').click();
    await page.getByRole('textbox', { name: 'Next-time kg target for set 1' }).fill('62');
    await page.getByTestId('set-details-sheet').getByRole('button', { name: 'Close Set 1' }).click();
    await expect(page.getByTestId('set-details-sheet')).toHaveCount(0);

    const dot = page.getByLabel('Set 1 has a next session target');
    await expect(dot).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    if (testInfo.project.name === 'iphone-air') {
      await page.screenshot({ path: testInfo.outputPath('dark-set-target-indicator-iphone.png') });
    }
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
  }, testInfo) => {
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
    // The width and selected index can animate on separate frames. Sample the
    // entire compacting transition, not only the settled endpoint, because a
    // stale child-layout reading on iOS was the original offset regression.
    for (let frame = 0; frame < 7; frame += 1) {
      const [pillDuringTransition, workoutTabDuringTransition] = await Promise.all([
        page.getByTestId('dashboard-nav-selection-pill').boundingBox(),
        page.getByRole('tab', { name: 'Workout', exact: true }).boundingBox(),
      ]);
      if (!pillDuringTransition || !workoutTabDuringTransition)
        throw new Error('Expected dock geometry during compact transition');
      expect(Math.abs(
        pillDuringTransition.x + pillDuringTransition.width / 2
          - (workoutTabDuringTransition.x + workoutTabDuringTransition.width / 2),
      )).toBeLessThan(2);
      await page.waitForTimeout(40);
    }
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
    expect(pill.width).toBeGreaterThanOrEqual(44);
    expect(pill.width).toBeLessThan(workoutTab.width);
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
    if (testInfo.project.name === 'iphone-air') {
      await page.screenshot({ path: testInfo.outputPath('compact-workout-dock-iphone.png') });
    }
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
    await selectStandardBarbellBenchPress(page);
    await page.getByRole('button', { name: 'Confirm selected exercises' }).click();
    await page.getByRole('button', { name: 'More options for Barbell Bench Press' }).click();
    await expect(page.getByText('Exercise options', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Remove Barbell Bench Press' }).locator('svg'),
    ).toHaveCount(1);
    await page.getByRole('button', { name: 'Remove Barbell Bench Press' }).click();
    await expect(page.getByText('Remove Barbell Bench Press?', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Keep exercise' }).click();
    await expect(page.getByText('Barbell Bench Press', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'More options for Barbell Bench Press' }).click();
    await page.getByRole('button', { name: 'Remove Barbell Bench Press' }).click();
    await page.getByRole('button', { name: 'Remove exercise' }).click();
    await expect(page.getByText('Start with an exercise', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add exercise' }).last()).toBeVisible();
  });

  test('makes every active exercise option substantive without changing its tracking type', async ({ page }, testInfo) => {
    await startEmptyWorkoutWithExercise(page);
    await page.getByRole('button', { name: 'More options for Barbell Bench Press' }).click();
    await expect(page.getByRole('button', { name: 'Measure by' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Add note' }).click();
    if (testInfo.project.name === 'iphone-air') {
      await page.waitForTimeout(260);
      await page.screenshot({ path: testInfo.outputPath('exercise-note-iphone.png') });
    }
    await expect(page.getByText('Exercise note', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to exercise options' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close exercise note' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Exercise note' }).fill('Pause at the chest');
    await page.getByRole('button', { name: 'Back to exercise options' }).click();
    await expect(page.getByText('Exercise options', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Previous sessions' }).click();
    await expect(page.getByText('No completed sessions for this exercise yet.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Close previous sessions/i }).click();
    await expect(page.getByText('Previous sessions', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Pause at the chest', { exact: true })).toHaveCount(0);
    await expect(page.locator('svg[aria-label="Exercise has a comment"]')).toBeVisible();
    if (testInfo.project.name === 'iphone-air') {
      await page.screenshot({ path: testInfo.outputPath('commented-exercise-card-iphone.png') });
    }

    await page.getByRole('button', { name: 'More options for Barbell Bench Press' }).click();
    await page.getByRole('button', { name: 'Warm-up sets' }).click();
    await page.getByLabel('Working weight').fill('100');
    await page.getByLabel('Working reps').fill('8');
    await expect(page.getByRole('button', { name: 'Add warm-up sets' })).toBeEnabled();
    await page.getByRole('button', { name: 'Add warm-up sets' }).click();
    await expect(page.getByLabel(/^Kg for set/)).toHaveCount(6);

    await page.getByRole('button', { name: 'More options for Barbell Bench Press' }).click();
    await page.getByRole('button', { name: 'Exercise info' }).click();
    await expect(page.getByText('Exercise', { exact: true })).toBeVisible();
    await expect(page.getByText('Variation', { exact: true })).toBeVisible();
    await expect(page.getByText('Movement family', { exact: true })).toBeVisible();
    await expect(page.getByText('Bench Press', { exact: true })).toBeVisible();
    if (testInfo.project.name === 'iphone-air') {
      await page.waitForTimeout(260);
      await page.screenshot({ path: testInfo.outputPath('exercise-options-info-iphone.png') });
    }
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
    await expect(page.getByLabel(/^Weight for set/)).toHaveCount(2);
  });

  test('removes the exercise card when its last set is deleted', async ({ page }) => {
    await startEmptyWorkoutWithExercise(page);
    for (const remaining of [2, 1, 0]) {
      await swipeLeftFrom(page, page.getByLabel('Weight for set 1'));
      await page.getByRole('button', { name: 'Delete set 1' }).click();
      await expect(page.getByLabel(/^Weight for set/)).toHaveCount(remaining);
    }
    await expect(page.getByText('Barbell Bench Press', { exact: true })).toHaveCount(0);
  });

  test('reveals delete action when swiping from a weight input', async ({ page }) => {
    await startEmptyWorkoutWithExercise(page);
    await swipeLeftFrom(page, page.getByLabel('Weight for set 1'));
    await expect(page.getByRole('button', { name: 'Delete set 1' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete set 1' }).click();
    await expect(page.getByLabel(/^Weight for set/)).toHaveCount(2);
  });

  test('reveals delete action when swiping from a reps input', async ({ page }) => {
    await startEmptyWorkoutWithExercise(page);
    await swipeLeftFrom(page, page.getByLabel('Reps for set 1'));
    await expect(page.getByRole('button', { name: 'Delete set 1' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete set 1' }).click();
    await expect(page.getByLabel(/^Reps for set/)).toHaveCount(2);
  });
});
