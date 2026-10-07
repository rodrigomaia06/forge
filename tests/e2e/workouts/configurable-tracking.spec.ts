import { test, expect, type Page } from '@playwright/test';
import { exerciseCatalogById } from '../../../src/data/exerciseCatalog';
import { createExerciseSnapshot } from '../../../src/domain/exercises/exerciseSnapshot';
import type { Workout, WorkoutExercise, PlansState } from '../../../src/types';
import { routineStructureBaseline } from '../../../src/domain/workouts/routineStructure';

const bench = [...exerciseCatalogById.values()].find(
  (item) => item.name === 'Barbell Bench Press',
)!;
const running = [...exerciseCatalogById.values()].find((item) => item.name === 'Running')!;
function movement(cardio = false): WorkoutExercise {
  const item = cardio ? running : bench;
  return {
    id: 'ex',
    exerciseId: item.id,
    name: item.name,
    trackingType: item.trackingType,
    exerciseSnapshot: createExerciseSnapshot(item),
    sets: [{ id: 's', weight: '', reps: '', completed: false }],
  };
}
function session(exercises = [movement()]): Workout {
  return {
    id: 'tracking-workout',
    name: 'Push',
    type: 'Strength',
    startedAt: Date.now() - 90000,
    completedAt: null,
    note: '',
    exercises,
  };
}
function sourceState(exercise: WorkoutExercise): PlansState {
  return {
    plans: [
      {
        id: 'plan',
        name: 'Training plan',
        createdAt: 1,
        updatedAt: 1,
        routines: [
          {
            id: 'routine',
            name: 'Push',
            type: 'Strength',
            planId: 'plan',
            createdAt: 1,
            updatedAt: 1,
            exercises: [exercise],
          },
        ],
      },
    ],
    standaloneRoutines: [],
  };
}
async function seed(
  page: Page,
  workout: Workout,
  plans: PlansState = { plans: [], standaloneRoutines: [] },
  appearance: 'light' | 'dark' = 'dark',
  history: Workout[] = [],
  restEnabled = false,
) {
  await page.addInitScript(
    ({ workout, plans, appearance, history, restEnabled }) => {
      if (sessionStorage.getItem('tracking-seeded')) return;
      sessionStorage.setItem('tracking-seeded', 'yes');
      localStorage.setItem(
        '@forge/settings-preferences',
        JSON.stringify({ appearance, showRestTimer: restEnabled }),
      );
      localStorage.setItem('@forge/active-workout', JSON.stringify(workout));
      localStorage.setItem('@forge/completed-workouts', JSON.stringify(history));
      localStorage.setItem('@forge/plans-v1', JSON.stringify(plans));
      if (restEnabled)
        localStorage.setItem(
          '@forge/rest-timer-v1',
          JSON.stringify({ workoutId: workout.id, endAt: Date.now() + 90000, duration: 90 }),
        );
    },
    { workout, plans, appearance, history, restEnabled },
  );
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Finish workout', exact: true })).toBeVisible();
  await page.evaluate(() => {
    const flashes: string[] = [];
    Object.assign(window, { finishFlashes: flashes });
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.textContent?.includes('No active workout')) flashes.push(node.textContent);
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  });
}
async function tracking(page: Page, name: string) {
  await page
    .getByRole('button', { name: `More options for ${name}`, exact: true })
    .first()
    .click();
  await page.getByRole('button', { name: 'Tracking', exact: true }).click();
}
async function saved(page: Page) {
  return page.evaluate(() => ({
    history: JSON.parse(localStorage.getItem('@forge/completed-workouts') ?? '[]'),
    plans: JSON.parse(localStorage.getItem('@forge/plans-v1') ?? '{}'),
    active: JSON.parse(localStorage.getItem('@forge/active-workout') ?? 'null'),
  }));
}

async function expectDirectDashboard(page: Page) {
  await expect(page.getByTestId('dashboard-app-screen')).toBeVisible();
  await expect(page.getByTestId('finish-workout-sheet')).toHaveCount(0);
  expect(
    await page.evaluate(
      () => (window as typeof window & { finishFlashes: string[] }).finishFlashes,
    ),
  ).toEqual([]);
  await page.waitForTimeout(350);
}

for (const appearance of ['light', 'dark'] as const) {
  test(`${appearance} exercise duration retains its Default header reset`, async ({ page }, info) => {
    const exercise = movement();
    exercise.exerciseSnapshot!.restSeconds = 100;
    await seed(page, session([exercise]), undefined, appearance);
    await page.getByRole('button', { name: `More options for ${exercise.name}`, exact: true }).click();
    await page.getByRole('button', { name: 'Exercise info', exact: true }).click();
    await page.getByRole('button', { name: /Change rest time, currently/ }).click();
    const reset = page.getByRole('button', { name: 'Use default rest time', exact: true });
    await expect(reset).toBeVisible();
    await expect(reset).toHaveText('Default');
    await expect(reset).toHaveCSS('border-top-width', '1px');
    await page.waitForTimeout(550);
    await page.screenshot({ path: info.outputPath('timer-default-header.png') });
    await reset.click();
    await expect(page.getByRole('button', { name: /Change rest time, currently Default/ })).toBeVisible();
    await expect(reset).toHaveCount(0);
  });
  for (const partial of [false, true]) {
    test(`live tracking protects repeated blocks and rest state (${appearance}, partial=${partial})`, async ({
      page,
    }, info) => {
      const item = [...exerciseCatalogById.values()].find(
        (item) => item.trackingType === 'weighted-bodyweight' && /pull.up/i.test(item.name),
      )!;
      const block: WorkoutExercise = {
        ...movement(),
        id: 'first',
        exerciseId: item.id,
        name: item.name,
        exerciseSnapshot: createExerciseSnapshot(item),
        trackingType: item.trackingType,
        trackingOverride: 'weighted-bodyweight-duration',
      };
      block.sets[0] = {
        ...block.sets[0],
        weight: '15',
        targets: [{ id: 'target', kind: 'duration', unit: 'sec', minValue: 45 }],
        ...(partial ? { sideCompletion: { left: true, right: false } } : {}),
      };
      const other = {
        ...block,
        id: 'second',
        sets: [{ id: 'second-set', weight: '20', reps: '', completed: false }],
      };
      await seed(
        page,
        session([block, other]),
        { plans: [], standaloneRoutines: [] },
        appearance,
        [],
        true,
      );
      const timerBefore = await page.evaluate(() => localStorage.getItem('@forge/rest-timer-v1'));
      await tracking(page, block.name);
      if (!partial) {
        await page.getByRole('radio', { name: 'Added weight + reps', exact: true }).tap();
        await expect(
          page.getByRole('button', { name: 'Change tracking', exact: true }),
        ).toBeVisible();
        await page.screenshot({ path: info.outputPath('target-only-confirmation.png') });
        await page.getByRole('button', { name: 'Close tracking', exact: true }).last().click();
        expect((await saved(page)).active.exercises[0].trackingOverride).toBe(
          'weighted-bodyweight-duration',
        );
        await tracking(page, block.name);
      }
      await page.getByRole('radio', { name: 'Added weight + reps', exact: true }).tap();
      if (!partial)
        await page
          .getByRole('button', { name: 'Change tracking', exact: true })
          .evaluate((element) => {
            (element as HTMLElement).click();
            (element as HTMLElement).click();
          });
      await expect
        .poll(async () => (await saved(page)).active.exercises.length)
        .toBe(partial ? 3 : 2);
      await expect
        .poll(async () => (await saved(page)).active.exercises[partial ? 1 : 0].trackingOverride)
        .toBe('weighted-bodyweight');
      const current = (await saved(page)).active;
      expect(current.exercises.at(-1)).toMatchObject(JSON.parse(JSON.stringify(other)));
      if (partial) {
        expect(current.exercises[0]).toMatchObject(JSON.parse(JSON.stringify(block)));
        expect(current.exercises[1].sets).toHaveLength(3);
        await page.screenshot({ path: info.outputPath('partial-side-new-block.png') });
      } else {
        expect(current.exercises[0].sets[0]).toMatchObject({ weight: '15', targets: [] });
      }
      expect(await page.evaluate(() => localStorage.getItem('@forge/rest-timer-v1'))).toBe(
        timerBefore,
      );
    });
  }
}

for (const appearance of ['light', 'dark'] as const) {
  test(`${appearance} completed unchanged routine finishes directly without an intermediate screen`, async ({
    page,
  }, info) => {
    const original = movement();
    const logged = {
      ...original,
      sets: [{ ...original.sets[0], weight: '50', reps: '8', completed: true }],
    };
    const workout = {
      ...session([logged]),
      routineId: 'routine',
      planId: 'plan',
      routineStructureBaseline: routineStructureBaseline([original]),
    };
    await seed(page, workout, sourceState(original), appearance);
    await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
    await expect.poll(async () => (await saved(page)).history.length).toBe(1);
    await expectDirectDashboard(page);
    const state = await saved(page);
    expect(state.active).toBeNull();
    expect(state.history[0].exercises[0].sets[0].completed).toBe(true);
    expect(state.plans.plans[0].routines[0].exercises).toEqual(
      sourceState(original).plans[0].routines[0].exercises,
    );
    await page.screenshot({ path: info.outputPath('completed-direct-dashboard.png') });
  });
}

test('timed bench clears drafts only after confirmation and creates another block after completion', async ({
  page,
}, info) => {
  const exercise = movement();
  exercise.sets[0].weight = '50';
  exercise.sets[0].reps = '8';
  await seed(page, session([exercise]));
  await tracking(page, exercise.name);
  await page.waitForTimeout(220);
  await page.screenshot({ path: info.outputPath('tracking-choices.png') });
  await page.getByRole('radio', { name: 'Weight + time', exact: true }).click();
  await page.getByRole('button', { name: 'Keep current tracking' }).click();
  await page.getByRole('radio', { name: 'Weight + time', exact: true }).click();
  await page.getByRole('button', { name: 'Change tracking', exact: true }).click();
  await expect(page.getByLabel('Reps for set 1')).toHaveCount(0);
  await expect(page.getByLabel('Kg for set 1')).toHaveValue('50');
  await page.getByLabel('Time for set 1').fill('1:30');
  await page.getByLabel('Time for set 1').blur();

  await expect(page.getByLabel('Time for set 1')).toHaveValue('01:30');
  await page.waitForTimeout(220);
  await page.screenshot({ path: info.outputPath('timed-columns.png') });
  await page.getByRole('button', { name: 'Open details for set 1', exact: true }).click();
  const durationTarget = page.getByRole('textbox', {
    name: 'Next-time time target for set 1',
    exact: true,
  });
  await durationTarget.fill('2,00');
  await durationTarget.blur();

  await expect(durationTarget).toHaveValue('02:00');
  await page
    .getByTestId('set-details-sheet')
    .getByRole('button', { name: 'Close Set 1', exact: true })
    .click();
  await page.getByRole('checkbox', { name: 'Complete set 1', exact: true }).click();
  await tracking(page, exercise.name);
  await page.getByRole('radio', { name: 'Weight + reps', exact: true }).click();
  await expect(page.getByLabel(/^Reps for set/)).toHaveCount(3);
  await expect(page.getByLabel('Time for set 1')).toHaveValue('01:30');
  await page.waitForTimeout(220);
  await page.screenshot({ path: info.outputPath('separate-blocks.png') });
  await expect.poll(async () => (await saved(page)).active?.exercises.length).toBe(2);
  const persisted = await saved(page);
  expect(persisted.active.exercises[0].sets[0].completed).toBe(true);
  expect(
    persisted.active.exercises[0].sets[0].measurements.find(
      (entry: { kind: string }) => entry.kind === 'duration',
    ).value,
  ).toBe(90);
  await page.goto('/');
  await expect(page.getByLabel('Time for set 1')).toHaveValue('01:30');
});

test('running supports distance, time and both with deterministic completion', async ({
  page,
}, info) => {
  const exercise = movement(true);
  await seed(page, session([exercise]));
  await tracking(page, exercise.name);
  await page.getByRole('radio', { name: 'Distance', exact: true }).click();
  await expect(page.getByLabel('Time for set 1')).toHaveCount(0);
  await page.getByLabel('KM for set 1').fill('2');
  await tracking(page, exercise.name);
  await page.getByRole('radio', { name: 'Distance + time', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Complete set 1', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Complete set 1', exact: true })).toBeVisible();
  await tracking(page, exercise.name);
  await page.getByRole('radio', { name: 'Time', exact: true }).click();
  await page.getByRole('button', { name: 'Change tracking', exact: true }).click();
  await expect(page.getByLabel('KM for set 1')).toHaveCount(0);
  await page.getByLabel('Time for set 1').fill('60');
  await page.getByLabel('Time for set 1').blur();

  await expect(page.getByLabel('Time for set 1')).toHaveValue('01:00');
  await tracking(page, exercise.name);
  await page.getByRole('radio', { name: 'Distance + time', exact: true }).click();
  await page.getByLabel('KM for set 1').fill('1');
  await page.getByRole('checkbox', { name: 'Complete set 1', exact: true }).click();
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  await expect.poll(async () => (await saved(page)).history.length).toBe(1);
  await expect(page.getByTestId('finish-workout-sheet')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('completed-without-prompt.png') });
});

for (const choice of ['Keep original routine', 'Update existing routine', 'Save as new routine'])
  test(`finish outcome: ${choice}`, async ({ page }, info) => {
    const original = movement();
    const exercise = { ...original, trackingOverride: 'duration-weight' as const };
    const workout = {
      ...session([exercise]),
      routineId: 'routine',
      planId: 'plan',
      routineStructureBaseline: routineStructureBaseline([original]),
    };
    await seed(page, workout, sourceState(original));
    await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
    const sheet = page.getByTestId('finish-workout-sheet');
    const final = sheet.getByRole('button', { name: 'Finish with 1 incomplete set', exact: true });
    await expect(final).toBeDisabled();
    await sheet.getByRole('radio', { name: choice, exact: true }).click();
    if (choice === 'Save as new routine') {
      await expect(sheet.getByLabel('New routine name')).toHaveValue('Push (new)');
      await sheet.getByLabel('New routine name').fill(' ');
      await expect(final).toBeDisabled();
      await sheet.getByLabel('New routine name').fill('Timed push');
      await sheet.getByLabel('New routine name').blur();
    }
    await page.waitForTimeout(220);
    await page.waitForTimeout(220);
    if (choice === 'Save as new routine')
      await sheet.getByText('Destination: Training plan').scrollIntoViewIfNeeded();
    await page.screenshot({
      path: info.outputPath(
        choice === 'Save as new routine' ? 'new-routine-finish.png' : 'incomplete-finish.png',
      ),
    });
    await final.click();
    await expect.poll(async () => (await saved(page)).history.length).toBe(1);
    await expectDirectDashboard(page);
    const persisted = await saved(page);
    expect(persisted.history[0].exercises[0].sets[0].completed).toBe(false);
    expect(persisted.active).toBeNull();
    const routines = persisted.plans.plans[0].routines;
    expect(routines).toHaveLength(choice === 'Save as new routine' ? 2 : 1);
    expect(routines[0].exercises[0].trackingOverride).toBe(
      choice === 'Update existing routine' ? 'duration-weight' : undefined,
    );
    if (choice === 'Save as new routine') expect(routines[1].name).toBe('Timed push');
  });

test('empty workouts finish immediately and duplicate taps save one entry', async ({
  page,
}, info) => {
  await seed(page, session([]));
  await page.getByRole('button', { name: 'Finish workout', exact: true }).evaluate((element) => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await expect.poll(async () => (await saved(page)).history.length).toBe(1);
  await expect(page.getByTestId('finish-workout-sheet')).toHaveCount(0);
  await expectDirectDashboard(page);
  expect((await saved(page)).active).toBeNull();
  expect((await saved(page)).history[0].exercises).toEqual([]);
  await page.screenshot({ path: info.outputPath('empty-workout-finished.png') });
});

test('empty routine workouts retain the original routine and can retry a failed save', async ({
  page,
}, info) => {
  const original = movement();
  const workout = {
    ...session([]),
    routineId: 'routine',
    planId: 'plan',
    routineStructureBaseline: routineStructureBaseline([original]),
  };
  await seed(page, workout, sourceState(original));
  await page.evaluate(() => {
    const setItem = Storage.prototype.setItem;
    let once = true;
    Storage.prototype.setItem = function (key, value) {
      if (key === '@forge/completed-workouts' && once) {
        once = false;
        throw new Error('Injected storage failure');
      }
      return setItem.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('The workout could not be saved. Try again.');
  await expect(page.getByTestId('finish-workout-sheet')).toHaveCount(0);
  expect((await saved(page)).history).toHaveLength(0);
  expect((await saved(page)).active.exercises).toEqual([]);
  await page.screenshot({ path: info.outputPath('empty-finish-error.png') });
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  await expect.poll(async () => (await saved(page)).history.length).toBe(1);
  expect((await saved(page)).plans.plans[0].routines[0].exercises).toEqual(
    sourceState(original).plans[0].routines[0].exercises,
  );
});

test('deleted source omits update; failing save retains choices and retry prevents duplicates', async ({
  page,
}, info) => {
  const original = movement();
  const workout = {
    ...session([original]),
    routineId: 'deleted',
    planId: 'deleted',
    routineStructureBaseline: routineStructureBaseline([]),
  };
  await seed(page, workout);
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  const sheet = page.getByTestId('finish-workout-sheet');
  await expect(sheet.getByRole('radio', { name: 'Update existing routine' })).toHaveCount(0);
  await sheet.getByRole('radio', { name: 'Save as new routine', exact: true }).click();
  await expect(sheet.getByText('Destination: Standalone routines')).toBeVisible();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    let once = true;
    Storage.prototype.setItem = function (key, value) {
      if (key === '@forge/completed-workouts' && once) {
        once = false;
        throw new Error('Injected storage failure');
      }
      return original.call(this, key, value);
    };
  });
  const final = sheet.getByRole('button', { name: 'Finish with 1 incomplete set', exact: true });
  await final.click();
  await expect(sheet.getByRole('alert')).toContainText('could not be saved');
  expect((await saved(page)).plans.standaloneRoutines).toHaveLength(0);
  expect((await saved(page)).history).toHaveLength(0);
  await expect(sheet.getByLabel('New routine name')).toHaveValue('Push (new)');
  await page.waitForTimeout(220);
  await page.screenshot({ path: info.outputPath('retry-finish.png') });
  await final.evaluate((element) => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await expect.poll(async () => (await saved(page)).history.length).toBe(1);
  expect((await saved(page)).plans.standaloneRoutines).toHaveLength(1);
});

test('routine tracking is persisted and starts future sessions with the same mode', async ({
  page,
}, info) => {
  const original = movement();
  await seed(page, session([]), sourceState(original));
  await page.getByRole('tab', { name: 'Plans', exact: true }).click();
  await page.getByRole('button', { name: 'Routine actions for Push', exact: true }).click();
  await page
    .getByTestId('plans-options-sheet')
    .getByRole('button', { name: 'Edit', exact: true })
    .click();
  await page.getByRole('button', { name: `Expand ${original.name}`, exact: true }).click();
  await tracking(page, original.name);
  await page.getByRole('radio', { name: 'Weight + time', exact: true }).click();
  await expect(page.getByLabel('Sec for set 1')).toBeVisible();
  await page.getByLabel('Sec for set 1').fill('30-60');
  await page.getByLabel('Sec for set 1').blur();
  await page.waitForTimeout(220);
  await page.screenshot({ path: info.outputPath('routine-tracking.png') });
  await page.getByRole('button', { name: 'Save routine', exact: true }).click();
  await page.getByRole('button', { name: 'Update routine', exact: true }).click();
  await expect
    .poll(async () => (await saved(page)).plans.plans[0].routines[0].exercises[0].trackingOverride)
    .toBe('duration-weight');
  // Close the untouched live session, then start the edited routine.
  await page.getByRole('tab', { name: 'Workout', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel workout', exact: true }).click();
  await page.getByRole('tab', { name: 'Plans', exact: true }).click();
  await page.getByRole('button', { name: 'Routine actions for Push', exact: true }).click();
  await page
    .getByTestId('plans-options-sheet')
    .getByRole('button', { name: 'Start', exact: true })
    .click();
  await expect(page.getByLabel('Time for set 1')).toBeVisible();
  await expect(page.getByLabel('Reps for set 1')).toHaveCount(0);
});

test('partially completed unilateral sets finish without marking the other side complete', async ({
  page,
}) => {
  const item = [...exerciseCatalogById.values()].find(
    (item) => item.laterality === 'unilateral' && item.trackingType === 'weight-reps',
  )!;
  const original = {
    ...movement(),
    exerciseId: item.id,
    name: item.name,
    exerciseSnapshot: createExerciseSnapshot(item),
  };
  original.sets[0] = {
    ...original.sets[0],
    weight: '20',
    reps: '8',
    sideCompletion: { left: true, right: false },
  };
  await seed(page, session([original]));
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  const sheet = page.getByTestId('finish-workout-sheet');
  await expect(sheet.getByTestId('finish-incomplete-count')).toBeVisible();
  await sheet.getByRole('button', { name: 'Finish with 1 incomplete set', exact: true }).click();
  await expect.poll(async () => (await saved(page)).history.length).toBe(1);
  expect((await saved(page)).history[0].exercises[0].sets[0].sideCompletion).toEqual({
    left: true,
    right: false,
  });
});

for (const appearance of ['light', 'dark'] as const)
  test(`weighted pull-up time to reps confirms data loss (${appearance})`, async ({
    page,
  }, info) => {
    const item = [...exerciseCatalogById.values()].find(
      (item) => item.trackingType === 'weighted-bodyweight' && /pull.up/i.test(item.name),
    )!;
    expect(item).toBeTruthy();
    const exercise: WorkoutExercise = {
      ...movement(),
      exerciseId: item.id,
      name: item.name,
      trackingType: item.trackingType,
      exerciseSnapshot: createExerciseSnapshot(item),
      trackingOverride: 'weighted-bodyweight-duration',
    };
    await seed(page, session([exercise]), { plans: [], standaloneRoutines: [] }, appearance);
    await page.getByRole('button', { name: 'Open details for set 1', exact: true }).click();
    await page.waitForTimeout(350);
    await page.screenshot({ path: info.outputPath('set-options-clearance.png') });
    await page.getByRole('button', { name: 'Close Set 1', exact: true }).click();
    await page.getByLabel('Added kg for set 1').fill('15');
    await page.getByLabel('Time for set 1').fill('1,30');
    // Open options directly from a focused duration field, matching the iPhone report.
    await tracking(page, exercise.name);
    await page.getByRole('radio', { name: 'Added weight + reps', exact: true }).tap();
    await expect(page.getByRole('button', { name: 'Change tracking', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Change tracking', exact: true })).toHaveText(
      'Clear time and use reps',
    );
    await page.waitForTimeout(350);
    await page.screenshot({ path: info.outputPath('weighted-pull-up-confirmation.png') });
    await page
      .getByRole('button', { name: 'Change tracking', exact: true })
      .locator('..')
      .screenshot({ path: info.outputPath('confirmation-buttons-detail.png') });
    await page.getByRole('button', { name: 'Keep current tracking', exact: true }).tap();
    await page.getByRole('radio', { name: 'Added weight + reps', exact: true }).tap();
    await page.getByRole('button', { name: 'Change tracking', exact: true }).tap();
    await expect(page.getByLabel('Added kg for set 1')).toHaveValue('15');
    await expect(page.getByLabel('Reps for set 1')).toHaveValue('');
    await expect
      .poll(async () => (await saved(page)).active.exercises[0].trackingOverride)
      .toBe('weighted-bodyweight');
    const persisted = (await saved(page)).active.exercises[0];
    expect(
      persisted.sets[0].measurements.some((entry: { kind: string }) => entry.kind === 'duration'),
    ).toBe(false);
    // The static test server has no route fallback; restart from its root.
    await page.goto('/');
    await expect(page.getByLabel('Reps for set 1')).toBeVisible();
    await expect(page.getByLabel('Added kg for set 1')).toHaveValue('15');
  });

test('legacy routine without exercise IDs can confirm timed weighted pull-up changes', async ({
  page,
}, info) => {
  const item = [...exerciseCatalogById.values()].find(
    (item) => item.trackingType === 'weighted-bodyweight' && /pull.up/i.test(item.name),
  )!;
  const exercise: WorkoutExercise = {
    ...movement(),
    exerciseId: item.id,
    name: item.name,
    trackingType: item.trackingType,
    exerciseSnapshot: createExerciseSnapshot(item),
    trackingOverride: 'weighted-bodyweight-duration',
  };
  exercise.sets[0].plannedTargets = [
    { id: 'duration-target', kind: 'duration', unit: 'sec', minValue: 30, maxValue: 60 },
  ];
  const plans = sourceState(exercise);
  plans.plans[0].routines[0].exercises[0].id = undefined;
  await seed(page, session([]), plans);
  await page.getByRole('tab', { name: 'Plans', exact: true }).click();
  await page.getByRole('button', { name: 'Routine actions for Push', exact: true }).click();
  await page
    .getByTestId('plans-options-sheet')
    .getByRole('button', { name: 'Edit', exact: true })
    .click();
  await page.getByRole('button', { name: `Expand ${exercise.name}`, exact: true }).click();
  await tracking(page, exercise.name);
  await page.getByRole('radio', { name: 'Added weight + reps', exact: true }).tap();
  await expect(page.getByRole('button', { name: 'Change tracking', exact: true })).toBeVisible();
  await page.waitForTimeout(350);
  await page.screenshot({ path: info.outputPath('routine-tracking-confirmation.png') });
  await page.getByRole('button', { name: 'Change tracking', exact: true }).tap();
  await expect(page.getByLabel('Reps for set 1')).toBeVisible();
  await expect(page.getByLabel('Sec for set 1')).toHaveCount(0);
});

test('history tracking confirms removing duration and saves the selected mode', async ({
  page,
}, info) => {
  const item = [...exerciseCatalogById.values()].find(
    (item) => item.trackingType === 'weighted-bodyweight' && /pull.up/i.test(item.name),
  )!;
  const exercise: WorkoutExercise = {
    ...movement(),
    exerciseId: item.id,
    name: item.name,
    trackingType: item.trackingType,
    exerciseSnapshot: createExerciseSnapshot(item),
    trackingOverride: 'weighted-bodyweight-duration',
    sets: [
      {
        id: 's',
        weight: '15',
        reps: '',
        completed: false,
        measurements: [{ id: 'time', kind: 'duration', unit: 'sec', value: 90 }],
      },
    ],
  };
  const history = {
    ...session([exercise]),
    id: 'past',
    name: 'Past Pull',
    completedAt: Date.now(),
  };
  await seed(page, session([]), { plans: [], standaloneRoutines: [] }, 'dark', [history]);
  await page.getByRole('tab', { name: 'History', exact: true }).click();
  await page.getByRole('button', { name: 'Open Past Pull', exact: true }).click();
  await page.getByRole('button', { name: 'Workout options', exact: true }).click();
  await page.getByRole('button', { name: 'Edit workout', exact: true }).click();
  await tracking(page, exercise.name);
  await page.getByRole('radio', { name: 'Added weight + reps', exact: true }).tap();
  await expect(page.getByRole('button', { name: 'Change tracking', exact: true })).toBeVisible();
  await page.waitForTimeout(350);
  await page.screenshot({ path: info.outputPath('history-tracking-confirmation.png') });
  await page.getByRole('button', { name: 'Change tracking', exact: true }).tap();
  await expect(page.getByLabel('Reps for set 1')).toBeVisible();
  await expect(page.getByLabel('Added kg for set 1')).toHaveValue('15');
  await page.getByRole('button', { name: 'Save workout', exact: true }).click();
  await expect
    .poll(
      async () =>
        (await saved(page)).history.find((workout: Workout) => workout.id === 'past')?.exercises[0]
          .trackingOverride,
    )
    .toBe('weighted-bodyweight');
});
