import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { exerciseCatalogById } from '../../../src/data/exerciseCatalog';
import { createExerciseSnapshot } from '../../../src/domain/exercises/exerciseSnapshot';
import type { Workout } from '../../../src/types';

const pistol = exerciseCatalogById.get('pistol-squat')!;
const bench = [...exerciseCatalogById.values()].find(
  (item) => item.name === 'Barbell Bench Press',
)!;
const exercises = [bench, pistol].map((item, index) => ({
  id: `ex-${index}`,
  exerciseId: item.id,
  name: item.name,
  trackingType: item.trackingType,
  exerciseSnapshot: createExerciseSnapshot(item),
  sets: [{ id: `set-${index}`, weight: '50', reps: '8', completed: false }],
}));
const now = Date.now();
const saved: Workout = {
  id: 'shapes-history',
  name: 'Shape check',
  type: 'Strength',
  note: '',
  startedAt: now - 600000,
  completedAt: now,
  exercises,
};

async function seed(page: Page, appearance: 'light' | 'dark', live = false) {
  await page.addInitScript(
    ({ appearance, saved, live }) => {
      localStorage.setItem(
        '@forge/settings-preferences',
        JSON.stringify({ appearance, showRestTimer: false }),
      );
      localStorage.setItem('@forge/completed-workouts', JSON.stringify([saved]));
      localStorage.setItem(
        '@forge/dashboard-layout-v1',
        JSON.stringify([
          { id: 'week', kind: 'week', visible: true },
          { id: 'calendar', kind: 'calendar', visible: true },
        ]),
      );
      if (live)
        localStorage.setItem(
          '@forge/active-workout',
          JSON.stringify({ ...saved, id: 'live-shapes', completedAt: null }),
        );
    },
    { appearance, saved, live },
  );
  await page.goto('/');
}

async function pressShape(
  page: Page,
  control: Locator,
  info: TestInfo,
  name: string,
  size: number,
  radius: number,
) {
  await control.scrollIntoViewIfNeeded();
  const bounds = await control.boundingBox();
  if (!bounds) throw new Error('Expected a visible control');
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  const layer = control.getByTestId('forge-press-state-layer');
  await expect(layer).toBeVisible();
  const tint = await layer.boundingBox();
  expect(tint!.width).toBeCloseTo(size, 0);
  expect(tint!.height).toBeCloseTo(size, 0);
  expect(tint!.x + size / 2).toBeCloseTo(bounds.x + bounds.width / 2, 0);
  expect(tint!.y + size / 2).toBeCloseTo(bounds.y + bounds.height / 2, 0);
  await expect(layer).toHaveCSS('border-radius', `${radius}px`);
  await page.screenshot({ path: info.outputPath(`${name}-pressed.png`) });
  await page.mouse.up();
  await expect(layer).toHaveCount(0);
}

for (const appearance of ['light', 'dark'] as const) {
  test(`${appearance} History editor selectors tint the button without its label`, async ({
    page,
  }, info) => {
    await seed(page, appearance);
    await page.getByRole('tab', { name: 'History', exact: true }).click();
    await page.getByRole('button', { name: 'Open Shape check', exact: true }).click();
    await page.getByRole('button', { name: 'Workout options', exact: true }).click();
    await page.getByRole('button', { name: 'Edit workout', exact: true }).click();
    const control = page.getByRole('button', { name: 'Choose workout type', exact: true });
    const label = control.locator('..').getByText('Type', { exact: true });
    await expect(control.getByText('Type', { exact: true })).toHaveCount(0);
    await label.click();
    await expect(page.getByTestId('history-type-sheet')).toHaveCount(0);
    await control.scrollIntoViewIfNeeded();
    const bounds = await control.boundingBox();
    const labelBounds = await label.boundingBox();
    expect(labelBounds!.y + labelBounds!.height).toBeLessThan(bounds!.y);
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
    await page.mouse.down();
    const layer = control.getByTestId('forge-press-state-layer');
    await expect(layer).toHaveCSS('border-radius', '12px');
    const tint = await layer.boundingBox();
    // The tint fills the button inside its existing one-pixel field border.
    expect(tint!.height).toBeCloseTo(bounds!.height - 2, 0);
    expect(tint!.width).toBeCloseTo(bounds!.width - 2, 0);
    expect(tint!.y).toBeGreaterThan(labelBounds!.y + labelBounds!.height);
    await page.screenshot({ path: info.outputPath('history-editor-type-pressed.png') });
    await page.mouse.up();
    await expect(
      page.getByRole('radio', { name: 'Use Cardio workout type', exact: true }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Close workout type picker', exact: true })
      .last()
      .click();
    for (const name of ['Date', 'Start time', 'End time']) {
      const field = page.getByRole('button', { name: `Select ${name}`, exact: true });
      await field.scrollIntoViewIfNeeded();
      await expect(field.getByText(name, { exact: true })).toHaveCount(0);
      const fieldBounds = await field.boundingBox();
      const title = await field.locator('..').getByText(name, { exact: true }).boundingBox();
      expect(title!.y + title!.height).toBeLessThan(fieldBounds!.y);
      expect(fieldBounds!.height).toBeGreaterThanOrEqual(44);
      await page.mouse.move(
        fieldBounds!.x + fieldBounds!.width / 2,
        fieldBounds!.y + fieldBounds!.height / 2,
      );
      await page.mouse.down();
      await expect(field.getByTestId('forge-press-state-layer')).toHaveCSS('border-radius', '10px');
      await page.screenshot({
        path: info.outputPath(`history-editor-${name.replaceAll(' ', '-')}-pressed.png`),
      });
      await page.mouse.up();
      await expect(page.getByTestId('history-date-time-picker-surface')).toBeVisible();
      await page
        .getByRole('button', { name: 'Close date and time picker', exact: true })
        .last()
        .click();
      await expect(page.getByTestId('history-date-time-picker-surface')).toHaveCount(0);
    }
  });

  test(`${appearance} Calendar and Dashboard day feedback follows the visible circles`, async ({
    page,
  }, info) => {
    await seed(page, appearance);
    const week = page.getByRole('button', { name: /Open .*'s Strength workout/ });
    await pressShape(page, week, info, 'dashboard-day', 32, 16);
    await page.getByRole('button', { name: 'Back to History', exact: true }).click();
    await page.getByRole('tab', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Calendar', exact: true }).click();
    const day = page.getByRole('button', { name: /Shape check/ });
    await expect(day).toHaveCSS('height', '46px');
    const disabledDay = page
      .getByRole('button')
      .and(page.locator('[aria-disabled="true"]'))
      .first();
    await expect(disabledDay).toBeDisabled();
    await disabledDay.dispatchEvent('pointerdown');
    await expect(disabledDay.getByTestId('forge-press-state-layer')).toHaveCount(0);
    await pressShape(page, day, info, 'calendar-day', 36, 18);
    await page.getByRole('button', { name: `Expand ${bench.name}`, exact: true }).click();
    await expect(page.getByTestId('history-set-number-chip-1').first()).toBeVisible();
    await pressShape(
      page,
      page.getByRole('button', { name: 'Open details for set 1', exact: true }).first(),
      info,
      'history-number',
      32,
      9,
    );
  });

  test(`${appearance} live set chips and both completion modes retain their shaped feedback`, async ({
    page,
  }, info) => {
    await seed(page, appearance, true);
    await pressShape(
      page,
      page.getByRole('button', { name: 'Open details for set 1', exact: true }).first(),
      info,
      'live-number',
      32,
      9,
    );
    await page.getByRole('button', { name: 'Close Set 1', exact: true }).last().click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await pressShape(
      page,
      page.getByRole('checkbox', { name: 'Complete set 1', exact: true }),
      info,
      'live-completion',
      30,
      15,
    );
    await pressShape(
      page,
      page.getByTestId('set-split-check-1'),
      info,
      'unilateral-completion',
      30,
      15,
    );
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem('@forge/active-workout') ?? 'null').exercises[0].sets[0]
              .completed,
        ),
      )
      .toBe(true);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem('@forge/active-workout') ?? 'null').exercises[1].sets[0]
              .sideCompletion?.left,
        ),
      )
      .toBe(true);
    const active = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('@forge/active-workout') ?? 'null'),
    );
    expect(active.exercises[0].sets[0].completed).toBe(true);
    expect(active.exercises[1].sets[0].completed).toBe(false);
    expect(active.exercises[1].sets[0].sideCompletion.left).toBe(true);
  });

  test(`${appearance} exercise-library leading-side feedback matches the rounded segments`, async ({
    page,
  }, info) => {
    await seed(page, appearance);
    await page.getByRole('tab', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Exercises', exact: true }).click();
    await page.getByRole('button', { name: 'All exercises, 608 exercises', exact: true }).click();
    await page.getByRole('textbox', { name: 'Search exercises', exact: true }).fill('Pistol Squat');
    await page.getByRole('button', { name: 'Open Pistol Squat', exact: true }).click();
    await page.waitForTimeout(350);
    for (const side of ['left', 'right']) {
      const control = page.getByRole('button', { name: `Lead with the ${side} side`, exact: true });
      await control.scrollIntoViewIfNeeded();
      const bounds = await control.boundingBox();
      await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
      await page.mouse.down();
      const layer = control.getByTestId('forge-press-state-layer');
      await expect(layer).toHaveCSS('border-radius', '8px');
      await page.screenshot({ path: info.outputPath(`library-${side}-pressed.png`) });
      await page.mouse.up();
      await expect(layer).toHaveCount(0);
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              JSON.parse(localStorage.getItem('@forge/settings-preferences') ?? '{}')
                .exerciseLeadSide?.['pistol-squat'] ?? 'left',
          ),
        )
        .toBe(side);
    }
  });
}
