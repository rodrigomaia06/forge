import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { exerciseCatalogById } from '../../../src/data/exerciseCatalog';
import { createExerciseSnapshot } from '../../../src/domain/exercises/exerciseSnapshot';

const bench = [...exerciseCatalogById.values()].find(
  (item) => item.name === 'Barbell Bench Press',
)!;
const exercise = {
  id: 'oval-exercise',
  exerciseId: bench.id,
  name: bench.name,
  trackingType: bench.trackingType,
  exerciseSnapshot: createExerciseSnapshot(bench),
  sets: [{ id: 'oval-set', weight: '50', reps: '8', completed: false }],
};
const workout = {
  id: 'oval-workout',
  name: 'Oval check',
  type: 'Strength',
  note: '',
  startedAt: 1,
  completedAt: 600001,
  exercises: [exercise],
};
const routine = {
  id: 'oval-routine',
  name: 'Oval routine',
  type: 'Strength',
  createdAt: 1,
  updatedAt: 1,
  exercises: [exercise],
};

async function heldShape(
  page: Page,
  control: Locator,
  info: TestInfo,
  name: string,
  width: number,
  height: number,
  radius: number,
) {
  await control.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  const box = await control.boundingBox();
  // Stop long-press activation while inspecting the initial held state, then
  // restore real timers before exercising the control's normal behavior.
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 50));
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.clock.runFor(80);
  const layer = control.getByTestId('forge-press-state-layer');
  await expect(layer).toBeVisible();
  await page.screenshot({ path: info.outputPath(`${name}-held.png`) });
  const tint = await layer.boundingBox();
  expect(tint!.width).toBeCloseTo(width, 0);
  expect(tint!.height).toBeCloseTo(height, 0);
  await expect(layer).toHaveCSS('border-radius', `${radius}px`);
  expect(tint!.x + width / 2).toBeCloseTo(box!.x + box!.width / 2, 0);
  expect(tint!.y + height / 2).toBeCloseTo(box!.y + box!.height / 2, 0);
  await page.mouse.move(1, 1);
  await page.clock.runFor(16);
  await page.mouse.up();
  await expect(layer).toHaveCount(0);
  await page.clock.resume();
}

for (const appearance of ['light', 'dark'] as const) {
  test.describe(appearance, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(
        ({ appearance, routine, workout }) => {
          localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance }));
          localStorage.setItem(
            '@forge/plans-v1',
            JSON.stringify({
              standaloneRoutines: [routine],
              plans: [
                { id: 'plan-a', name: 'First plan', routines: [], createdAt: 1, updatedAt: 1 },
                { id: 'plan-b', name: 'Second plan', routines: [], createdAt: 1, updatedAt: 1 },
              ],
            }),
          );
          localStorage.setItem('@forge/completed-workouts', JSON.stringify([workout]));
          localStorage.setItem(
            '@forge/dashboard-layout-v1',
            JSON.stringify([{ id: 'streak', kind: 'streak', visible: true }]),
          );
        },
        { appearance, routine, workout },
      );
      await page.clock.install();
      await page.goto('/');
    });

    test(`${appearance} exercise editor grips use inset oval feedback`, async ({ page }, info) => {
      await page.getByRole('tab', { name: 'Plans', exact: true }).click();
      await page
        .getByRole('button', { name: 'Routine actions for Oval routine', exact: true })
        .click();
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      await heldShape(
        page,
        page.getByRole('button', { name: 'Drag to reorder Barbell Bench Press', exact: true }),
        info,
        'routine-grip',
        28,
        40,
        14,
      );
      await page.getByRole('button', { name: 'Cancel editing routine', exact: true }).click();
      await page.getByRole('tab', { name: 'History', exact: true }).click();
      await page.getByRole('button', { name: 'Open Oval check', exact: true }).click();
      await heldShape(
        page,
        page.getByRole('button', { name: 'More options for Barbell Bench Press', exact: true }),
        info,
        'history-more',
        44,
        44,
        22,
      );
      await page.getByRole('button', { name: 'Back to History', exact: true }).click();
      await page.getByRole('tab', { name: 'Plans', exact: true }).click();
      await page.getByRole('button', { name: 'Start Oval routine', exact: true }).click();
      await page.getByRole('button', { name: 'Edit live workout', exact: true }).click();
      await heldShape(
        page,
        page.getByRole('button', { name: 'Drag to reorder Barbell Bench Press', exact: true }),
        info,
        'live-editor-grip',
        28,
        40,
        14,
      );
    });

    test(`${appearance} dashboard grips and plan arrows retain rounded feedback`, async ({
      page,
    }, info) => {
      await page.getByRole('button', { name: 'Edit dashboard', exact: true }).click();
      await heldShape(
        page,
        page.getByRole('button', { name: 'Reorder Streak tile', exact: true }),
        info,
        'dashboard-grip',
        28,
        40,
        14,
      );
      await page.getByRole('tab', { name: 'Plans', exact: true }).click();
      await page.getByRole('button', { name: 'Edit plans', exact: true }).click();
      const down = page.getByRole('button', { name: 'Move First plan down', exact: true });
      const box = await down.boundingBox();
      await heldShape(page, down, info, 'plan-down', box!.width, 24, 999);
      if (await down.isEnabled()) await down.click();
      await expect(
        page.getByRole('button', { name: 'Move First plan up', exact: true }),
      ).toBeEnabled();
    });

    test(`${appearance} search clear feedback is circular and clearing still works`, async ({
      page,
    }, info) => {
      await page.getByRole('tab', { name: 'Settings', exact: true }).click();
      await page.getByRole('button', { name: 'Exercises', exact: true }).click();
      await page.getByRole('button', { name: /^All exercises,/ }).click();
      await page.getByRole('textbox', { name: 'Search exercises', exact: true }).fill('bench');
      const clear = page.getByRole('button', { name: 'Clear search', exact: true });
      await heldShape(page, clear, info, 'search-clear', 28, 28, 14);
      await clear.click();
      await expect(
        page.getByRole('textbox', { name: 'Search exercises', exact: true }),
      ).toHaveValue('');
    });
  });
}
