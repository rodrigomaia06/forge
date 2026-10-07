import { expect, test, type Page } from '@playwright/test';
import { exerciseCatalogById } from '../../../src/data/exerciseCatalog';
import { createExerciseSnapshot } from '../../../src/domain/exercises/exerciseSnapshot';
import type { Workout } from '../../../src/types';

const bench = [...exerciseCatalogById.values()].find(
  (item) => item.name === 'Barbell Bench Press',
)!;

async function seed(page: Page, appearance: 'light' | 'dark') {
  const workout: Workout = {
    id: 'live-control-entry',
    name: 'Push',
    type: 'Strength',
    startedAt: Date.now() - 120000,
    completedAt: null,
    note: '',
    exercises: [
      {
        id: 'bench-block',
        exerciseId: bench.id,
        name: bench.name,
        trackingType: bench.trackingType,
        exerciseSnapshot: createExerciseSnapshot(bench),
        sets: [{ id: 'bench-set', weight: '50', reps: '', completed: false }],
      },
    ],
  };
  await page.addInitScript(
    ({ workout, appearance }) => {
      if (sessionStorage.getItem('live-control-entry-seeded')) return;
      sessionStorage.setItem('live-control-entry-seeded', 'yes');
      localStorage.setItem(
        '@forge/settings-preferences',
        JSON.stringify({ appearance, showRestTimer: true }),
      );
      localStorage.setItem('@forge/active-workout', JSON.stringify(workout));
    },
    { workout, appearance },
  );
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Finish workout', exact: true })).toBeVisible();
}

for (const appearance of ['light', 'dark'] as const) {
  test(`${appearance} live reps retain comma fractions through completion and reload`, async ({
    page,
  }, info) => {
    await seed(page, appearance);
    const reps = page.getByRole('textbox', { name: 'Reps for set 1', exact: true });
    await expect(reps).toHaveAttribute('inputmode', 'decimal');
    for (const [text, value] of [
      ['8,25', 8.25],
      ['8,5', 8.5],
      ['8,75', 8.75],
      ['8.25', 8.25],
    ] as const) {
      await reps.fill(text);
      await page.getByRole('textbox', { name: 'Kg for set 1', exact: true }).click();
      await expect(reps).toHaveValue(text);
      await expect
        .poll(() =>
          page.evaluate(() => {
            const set = JSON.parse(localStorage.getItem('@forge/active-workout') ?? 'null')
              ?.exercises[0].sets[0];
            return {
              raw: set?.reps,
              value: set?.measurements?.find((entry: { kind: string }) => entry.kind === 'reps')
                ?.value,
            };
          }),
        )
        .toEqual({ raw: text, value });
    }
    await reps.fill('8,');
    await reps.press('5');
    await expect(reps).toHaveValue('8,5');
    await reps.press('Backspace');
    await reps.press('2');
    await reps.press('5');
    await expect(reps).toHaveValue('8,25');
    await page.getByRole('checkbox', { name: 'Complete set 1', exact: true }).click();
    await expect(
      page.getByRole('checkbox', { name: 'Set 1 completed', exact: true }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem('@forge/active-workout') ?? 'null')?.exercises[0]
              .sets[0].completed,
        ),
      )
      .toBe(true);
    await page.goto('/');
    await expect(reps).toHaveValue('8,25');
    await expect(
      page.getByRole('checkbox', { name: 'Set 1 completed', exact: true }),
    ).toBeVisible();
    await expect
      .poll(() =>
        reps.evaluate((input) => {
          for (let node: Element | null = input; node; node = node.parentElement) {
            if (Number(getComputedStyle(node).opacity) < 1) return false;
          }
          return true;
        }),
      )
      .toBe(true);
    await page.screenshot({ path: info.outputPath('live-quarter-reps-reloaded.png') });
  });

  test(`${appearance} live three-dot action has circular feedback`, async ({ page }, info) => {
    await seed(page, appearance);
    const more = page.getByRole('button', { name: `More options for ${bench.name}`, exact: true });
    const bounds = (await more.boundingBox())!;
    expect(bounds.width).toBe(44);
    expect(bounds.height).toBe(44);
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down();
    const layer = more.getByTestId('forge-press-state-layer');
    await expect(layer).toHaveCSS('border-radius', '22px');
    await page.screenshot({ path: info.outputPath('live-more-circle-pressed.png') });
    await page.mouse.up();
    await expect(page.getByRole('button', { name: 'Tracking', exact: true })).toBeVisible();
  });

  test(`${appearance} live timer actions fill their strip`, async ({ page }, info) => {
    await seed(page, appearance);
    const elapsed = page.getByRole('button', { name: 'Open workout duration', exact: true });
    const rest = page.getByRole('button', { name: 'Start rest timer', exact: true });
    const panel = elapsed.locator('..');
    const bounds = (await panel.boundingBox())!;
    const left = (await elapsed.boundingBox())!;
    const right = (await rest.boundingBox())!;
    expect(left.x).toBeCloseTo(bounds.x, 0);
    expect(right.x + right.width).toBeCloseTo(bounds.x + bounds.width, 0);
    expect(left.width).toBeCloseTo(right.width, 0);
    expect(left.height).toBe(44);
    expect(right.height).toBe(44);
    expect(right.x - left.x - left.width).toBeCloseTo(1, 0);
    for (const [name, control] of [
      ['elapsed', elapsed],
      ['rest', rest],
    ] as const) {
      const box = (await control.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      const layer = control.getByTestId('forge-press-state-layer');
      const tint = (await layer.boundingBox())!;
      expect(tint.width).toBeCloseTo(box.width, 0);
      expect(tint.height).toBeCloseTo(box.height, 0);
      await page.screenshot({ path: info.outputPath(`${name}-full-strip-pressed.png`) });
      await page.mouse.move(1, 1);
      await page.mouse.up();
      await expect(layer).toHaveCount(0);
    }
    await elapsed.click();
    await expect(
      page.getByRole('button', { name: 'Close workout duration', exact: true }).last(),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Close workout duration', exact: true }).last().click();
    await rest.click();
    await expect(page.getByTestId('rest-timer-sheet-surface')).toBeVisible();
  });
}
