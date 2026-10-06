import { expect, test } from '@playwright/test';
import { startBlankWorkout } from '../support/workoutFlow';
import { exerciseCatalogById } from '../../../src/data/exerciseCatalog';
import { createExerciseSnapshot } from '../../../src/domain/exercises/exerciseSnapshot';

for (const appearance of ['light', 'dark']) {
  test(`${appearance} picker selected load contrasts with its panel`, async ({ page }, info) => {
    await page.addInitScript(
      (appearance) =>
        localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance })),
      appearance,
    );
    await startBlankWorkout(page);
    await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
    await page.getByLabel('Search exercises').fill('pull-up');
    await page.getByRole('button', { name: 'Pull-Up & 9 variations', exact: true }).click();
    const assisted = page.getByRole('checkbox', { name: 'Pull-Up, Assisted', exact: true });
    await assisted.click();
    await expect(assisted).toBeChecked();
    const colours = await assisted.evaluate((element) => [
      getComputedStyle(element).backgroundColor,
      getComputedStyle(element.parentElement!).backgroundColor,
    ]);
    expect(colours[0]).not.toBe(colours[1]);
    await page.waitForTimeout(220);
    await page.screenshot({ path: info.outputPath('selected-load.png') });
  });

  test(`${appearance} numeric time entry converts separators and locks the cursor`, async ({
    page,
  }, info) => {
    const item = [...exerciseCatalogById.values()].find(
      (item) => item.name === 'Barbell Bench Press',
    )!;
    await page.addInitScript(
      ({ item, appearance, snapshot }) => {
        localStorage.setItem(
          '@forge/settings-preferences',
          JSON.stringify({ appearance, showRestTimer: false }),
        );
        localStorage.setItem(
          '@forge/active-workout',
          JSON.stringify({
            id: 'numeric-time',
            name: 'Time',
            type: 'Strength',
            startedAt: Date.now(),
            completedAt: null,
            exercises: [
              {
                id: 'ex',
                exerciseId: item.id,
                name: item.name,
                exerciseSnapshot: snapshot,
                trackingOverride: 'duration-weight',
                sets: [{ id: 's', weight: '50', reps: '', completed: false }],
              },
            ],
          }),
        );
      },
      { item, appearance, snapshot: createExerciseSnapshot(item) },
    );
    await page.goto('/');
    const field = page.getByLabel('Time for set 1');
    await expect(field).toHaveAttribute('inputmode', 'decimal');
    await field.fill('90');
    await field.blur();
    await expect(field).toHaveValue('01:30');
    await field.fill('1,02,30');
    await expect(field).toHaveValue('1:02:30');
    await field.press('Home');
    await expect
      .poll(() => field.evaluate((input: HTMLInputElement) => input.selectionStart))
      .toBe(7);
    await field.blur();
    await expect(field).toHaveValue('1:02:30');
    await page.waitForTimeout(220);
    await page.screenshot({ path: info.outputPath('numeric-time.png') });
    await page.waitForTimeout(350);
    const duration = await page.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem('@forge/active-workout')!,
        ).exercises[0].sets[0].measurements.find(
          (entry: { kind: string }) => entry.kind === 'duration',
        ).value,
    );
    expect(duration).toBe(3750);
    await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
    await expect(page.getByTestId('finish-workout-scroll')).toHaveCSS('overflow-y', 'hidden');
    await page.screenshot({ path: info.outputPath('compact-finish.png') });
  });
}
