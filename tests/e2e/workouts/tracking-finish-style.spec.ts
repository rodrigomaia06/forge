import { test, expect } from '@playwright/test';
import { exerciseCatalogById } from '../../../src/data/exerciseCatalog';
import { createExerciseSnapshot } from '../../../src/domain/exercises/exerciseSnapshot';
import { routineStructureBaseline } from '../../../src/domain/workouts/routineStructure';
import type { Workout, WorkoutExercise, PlansState } from '../../../src/types';

const bench = [...exerciseCatalogById.values()].find(
  (item) => item.name === 'Barbell Bench Press',
)!;
for (const appearance of ['light', 'dark'] as const) {
  for (const state of ['tracking', 'complete', 'incomplete', 'empty'] as const) {
    test(`${appearance} ${state} uses compact Forge presentation`, async ({ page }, info) => {
      const exercise: WorkoutExercise = {
        id: 'exercise',
        exerciseId: bench.id,
        name: bench.name,
        trackingType: bench.trackingType,
        exerciseSnapshot: createExerciseSnapshot(bench),
        sets: [{ id: 'set', weight: '50', reps: '8', completed: state === 'complete' }],
      };
      const source = {
        id: 'routine',
        name: 'Push',
        type: 'Strength',
        exercises: [exercise],
        createdAt: 1,
        updatedAt: 1,
      };
      const plans: PlansState = { plans: [], standaloneRoutines: [source] };
      const workout: Workout = {
        id: 'style-session',
        name: 'Push',
        type: 'Strength',
        note: '',
        startedAt: Date.now() - 90000,
        completedAt: null,
        exercises: state === 'empty' ? [] : [exercise],
        ...(state === 'incomplete'
          ? { routineId: source.id, routineStructureBaseline: routineStructureBaseline([], source) }
          : {}),
      };
      await page.addInitScript(
        ({ appearance, workout, plans }) => {
          localStorage.setItem(
            '@forge/settings-preferences',
            JSON.stringify({ appearance, showRestTimer: false }),
          );
          localStorage.setItem('@forge/active-workout', JSON.stringify(workout));
          localStorage.setItem('@forge/completed-workouts', '[]');
          localStorage.setItem('@forge/plans-v1', JSON.stringify(plans));
        },
        { appearance, workout, plans },
      );
      await page.goto('/');
      await expect(page.getByRole('button', { name: 'Finish workout', exact: true })).toBeVisible();
      if (state === 'tracking') {
        await page
          .getByRole('button', { name: `More options for ${bench.name}`, exact: true })
          .click();
        await page.getByRole('button', { name: 'Tracking', exact: true }).click();
        await expect(
          page.getByText('Every field in the selected mode is required to complete a set.'),
        ).toHaveCount(0);
        await page.waitForTimeout(350);
        await expect(page.getByRole('radiogroup').locator('..').locator('..')).toHaveCSS(
          'padding-bottom',
          '32px',
        );
        await page.screenshot({ path: info.outputPath('tracking.png') });
        await page.getByRole('button', { name: 'Back to exercise options' }).click();
        await page.getByRole('button', { name: 'Add note', exact: true }).click();
        await page.waitForTimeout(350);
        await page.screenshot({ path: info.outputPath('note-spacing.png') });
        await page.getByRole('button', { name: 'Back to exercise options' }).click();
        await page.getByRole('button', { name: 'Tracking', exact: true }).click();
        await page.getByRole('radio', { name: 'Weight + time', exact: true }).click();
        await page.getByRole('button', { name: 'Change tracking', exact: true }).click();
        const time = page.getByLabel('Time for set 1');
        await expect(time).toHaveAttribute('inputmode', 'decimal');
        await time.fill('1,30');
        await expect(time).toHaveValue('1:30');
        await time.press('Home');
        await expect
          .poll(() => time.evaluate((input: HTMLInputElement) => input.selectionStart))
          .toBe(4);
        await page.getByLabel('Kg for set 1').click();
        await expect(page.getByText('Flat', { exact: true })).toBeVisible();
        await expect(page.getByText('Flat · Weight + time', { exact: true })).toHaveCount(0);
        await page.waitForTimeout(350);
        await page.screenshot({ path: info.outputPath('timed-columns.png') });
      } else {
        await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
        const sheet = page.getByTestId('finish-workout-sheet');
        await expect(sheet.getByText('Finish workout', { exact: true }).first()).toBeVisible();
        await page.waitForTimeout(350);
        await expect(sheet.getByRole('button', { name: state === 'empty' ? 'Save empty workout' : state === 'incomplete' ? 'Finish with 1 incomplete set' : 'Finish workout', exact: true })).toBeInViewport({ ratio: 1 });
        await page.screenshot({ path: info.outputPath(`${state}-finish.png`) });
        if (state !== 'incomplete') {
          await expect(sheet.getByTestId('finish-workout-scroll')).toHaveCSS(
            'overflow-y',
            'hidden',
          );
        }
        if (state === 'incomplete') {
          const count = sheet.getByTestId('finish-incomplete-count');
          await expect(count).toBeVisible();
          const countBounds = await count.boundingBox();
          const sheetBounds = await sheet.boundingBox();
          expect(countBounds!.x).toBeGreaterThan(sheetBounds!.x + sheetBounds!.width / 2);

          await sheet.getByRole('radio', { name: 'Save as new routine', exact: true }).click();
          await expect(sheet.getByLabel('New routine name')).toHaveValue('Push (copy)');
          await sheet.getByText('Destination: Standalone routines').scrollIntoViewIfNeeded();
          await page.waitForTimeout(350);
          await page.screenshot({ path: info.outputPath('new-routine.png') });
          await page.setViewportSize({ width: page.viewportSize()!.width, height: 440 });
          const action = sheet.getByRole('button', { name: 'Finish with 1 incomplete set', exact: true });
          await expect(action).toBeInViewport({ ratio: 1 });
          await expect(sheet.getByTestId('finish-workout-scroll')).toHaveCSS('overflow-y', 'auto');
          await page.waitForTimeout(350);
          await page.screenshot({ path: info.outputPath('short-viewport-finish.png') });

        }
      }
    });
  }
  test(`${appearance} muscle heatmap has legible front and back figures and a matching legend`, async ({
    page,
  }, info) => {
    const items = ['Barbell Bench Press', 'Barbell Back Squat', 'Pull-Up'];
    const exercises = items.map((name, index) => {
      const item = [...exerciseCatalogById.values()].find((item) => item.name === name)!;
      return {
        id: `ex-${index}`,
        exerciseId: item.id,
        name: item.name,
        exerciseSnapshot: createExerciseSnapshot(item),
        sets: Array.from({ length: 5 - index * 2 }, (_, n) => ({
          id: `set-${index}-${n}`,
          completed: true,
          weight: '50',
          reps: '8',
        })),
      };
    });
    await page.addInitScript(
      ({ appearance, exercises }) => {
        localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance }));
        localStorage.setItem(
          '@forge/dashboard-layout-v1',
          JSON.stringify([{ id: 'muscle-heatmap', kind: 'muscle-heatmap', visible: true }]),
        );
        localStorage.setItem(
          '@forge/completed-workouts',
          JSON.stringify([
            {
              id: 'heatmap',
              name: 'Strength',
              type: 'Strength',
              startedAt: Date.now() - 600000,
              completedAt: Date.now(),
              note: '',
              exercises,
            },
          ]),
        );
      },
      { appearance, exercises },
    );
    await page.goto('/');
    await expect(
      page.getByRole('button', { name: 'Open muscle heatmap', exact: true }),
    ).toBeVisible();
    await page.waitForTimeout(350);
    await page.screenshot({ path: info.outputPath('dashboard-heatmap.png') });
    await page.getByRole('button', { name: 'Open muscle heatmap', exact: true }).click();
    await expect(page.getByText('Working sets by group')).toBeVisible();
    for (const gender of ['male', 'female'] as const) {
      if (gender === 'female') {
        await page.getByRole('button', { name: 'Edit view', exact: true }).click();
        await page.getByRole('button', { name: 'Female', exact: true }).click();
        await page.getByRole('button', { name: 'Done editing', exact: true }).click();
      }
      const figures = page.locator(
        `svg[aria-label="${gender}-body-front"]:visible, svg[aria-label="${gender}-body-back"]:visible`,
      );
      await expect(figures).toHaveCount(2);
      // Untrained calves must use the theme neutral, not the asset's fixed charcoal.
      await expect(figures.first().locator('path[id="calves"]').first()).toHaveAttribute(
        'fill',
        appearance === 'light' ? '#D4D7D2' : '#2B2F34',
      );
      const boxes = await figures.evaluateAll((elements) =>
        elements.map((element) => {
          const bounds = element.getBoundingClientRect();
          return { left: bounds.left, right: bounds.right, width: bounds.width };
        }),
      );
      expect(boxes[0].right).toBeLessThanOrEqual(boxes[1].left);
      expect(boxes[0].left).toBeGreaterThan(0);
      expect(boxes[1].right).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
      await page.waitForTimeout(350);
      await page.screenshot({ path: info.outputPath(`${gender}-heatmap.png`) });
    }
  });
}
