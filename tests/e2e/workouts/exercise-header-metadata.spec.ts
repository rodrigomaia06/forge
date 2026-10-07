import { expect, test, type Page } from '@playwright/test';
import { exerciseCatalogById } from '../../../src/data/exerciseCatalog';
import { createExerciseSnapshot } from '../../../src/domain/exercises/exerciseSnapshot';
import type { Workout, WorkoutExercise } from '../../../src/types';

const bench = [...exerciseCatalogById.values()].find(
  (item) => item.name === 'Barbell Bench Press',
)!;
const block: WorkoutExercise = {
  id: 'bench',
  exerciseId: bench.id,
  name: bench.name,
  trackingType: bench.trackingType,
  exerciseSnapshot: createExerciseSnapshot(bench),
  sets: [{ id: 'set', weight: '40', reps: '8', completed: true }],
};

async function inspectHeader(page: Page, capture: () => Promise<void>, collapsed = true) {
  if (!collapsed) {
    await expect(page.getByText('Weight + reps', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Kg', { exact: true }).last()).toBeVisible();
    await expect(page.getByText('Reps', { exact: true }).last()).toBeVisible();
    await page.waitForTimeout(350);
    await capture();
    return;
  }
  const header = page.getByRole('button', { name: `Expand ${bench.name}`, exact: true });
  await expect(header).toContainText('1 set');
  await expect(header).not.toContainText('Weight + reps');
  await page.waitForTimeout(350);
  await capture();
  await header.click();
  await expect(page.getByText('Kg', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('Reps', { exact: true }).last()).toBeVisible();
}

for (const appearance of ['light', 'dark'] as const) {
  test(`${appearance} set headers omit redundant tracking across workout and routine screens`, async ({
    page,
  }, info) => {
    const workout: Workout = {
      id: 'header-history',
      name: 'Header workout',
      type: 'Strength',
      startedAt: Date.now() - 600000,
      completedAt: Date.now(),
      note: '',
      exercises: [block],
    };
    await page.addInitScript(
      ({ appearance, workout, block }) => {
        if (sessionStorage.getItem('header-seeded')) return;
        sessionStorage.setItem('header-seeded', 'yes');
        localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance }));
        localStorage.setItem('@forge/completed-workouts', JSON.stringify([workout]));
        localStorage.setItem(
          '@forge/plans-v1',
          JSON.stringify({
            plans: [],
            standaloneRoutines: [
              {
                id: 'header-routine',
                name: 'Header routine',
                type: 'Strength',
                createdAt: 1,
                updatedAt: 1,
                exercises: [block],
              },
            ],
          }),
        );
      },
      { appearance, workout, block },
    );
    const capture = (name: string) => () =>
      page.screenshot({ path: info.outputPath(`${name}.png`) }).then(() => {});
    await page.goto('/');
    await page.getByRole('tab', { name: 'History', exact: true }).click();
    await page.getByRole('button', { name: 'Open Header workout', exact: true }).click();
    await inspectHeader(page, capture('history-header'));
    await page.getByRole('button', { name: 'Workout options', exact: true }).click();
    await page.getByRole('button', { name: 'Edit workout', exact: true }).click();
    await inspectHeader(page, capture('history-editor-header'), false);
    await page.goto('/');
    await page.getByRole('tab', { name: 'Plans', exact: true }).click();
    await page
      .getByRole('button', { name: 'Routine actions for Header routine', exact: true })
      .click();
    await page
      .getByTestId('plans-options-sheet')
      .getByRole('button', { name: 'Visualize', exact: true })
      .click();
    await inspectHeader(page, capture('routine-preview-header'));
    await page.goto('/');
    await page.getByRole('tab', { name: 'Plans', exact: true }).click();
    await page
      .getByRole('button', { name: 'Routine actions for Header routine', exact: true })
      .click();
    await page
      .getByTestId('plans-options-sheet')
      .getByRole('button', { name: 'Edit', exact: true })
      .click();
    await inspectHeader(page, capture('routine-editor-header'));
    await page.evaluate(
      (workout) =>
        localStorage.setItem(
          '@forge/active-workout',
          JSON.stringify({ ...workout, id: 'header-active', completedAt: null }),
        ),
      workout,
    );
    await page.goto('/');
    await page.getByRole('button', { name: 'Edit live workout', exact: true }).click();
    await inspectHeader(page, capture('live-editor-header'));
  });
}
