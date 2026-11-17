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

async function seed(
  page: Page,
  appearance: 'light' | 'dark',
  live = false,
  tiles = ['week', 'calendar'],
  showRestTimer = false,
) {
  await page.addInitScript(
    ({ appearance, saved, live, tiles, showRestTimer }) => {
      localStorage.setItem(
        '@forge/settings-preferences',
        JSON.stringify({ appearance, showRestTimer }),
      );
      localStorage.setItem('@forge/completed-workouts', JSON.stringify([saved]));
      localStorage.setItem(
        '@forge/dashboard-layout-v1',
        JSON.stringify(tiles.map((kind) => ({ id: kind, kind, visible: true }))),
      );
      if (live)
        localStorage.setItem(
          '@forge/active-workout',
          JSON.stringify({ ...saved, id: 'live-shapes', completedAt: null }),
        );
    },
    { appearance, saved, live, tiles, showRestTimer },
  );
  await page.goto('/');
}

function expectPressedSize(actual: number, resting: number) {
  expect(actual).toBeGreaterThanOrEqual(resting * 0.96);
  expect(actual).toBeLessThanOrEqual(resting + 0.5);
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
  // Rounded pressables settle slightly inward while held (the shared press scale,
  // never below 0.97), so the tint is up to a few percent under its resting size
  // but stays centred on the control.
  expectPressedSize(tint!.width, size);
  expectPressedSize(tint!.height, size);
  expect(tint!.x + tint!.width / 2).toBeCloseTo(bounds.x + bounds.width / 2, 0);
  expect(tint!.y + tint!.height / 2).toBeCloseTo(bounds.y + bounds.height / 2, 0);
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
    // The tint fills the button inside its existing one-pixel field border (allowing
    // for the shared press scale while it is held).
    expectPressedSize(tint!.height, bounds!.height - 2);
    expectPressedSize(tint!.width, bounds!.width - 2);
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
      const control = page.getByRole('radio', { name: `Lead with the ${side} side`, exact: true });
      await control.scrollIntoViewIfNeeded();
      const bounds = await control.boundingBox();
      await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
      await page.mouse.down();
      const layer = control.getByTestId('forge-press-state-layer');
      // The shared segmented switch's segments are full pills, and the tint follows them.
      await expect(layer).toHaveCSS('border-radius', '999px');
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

/** Holds a control, returns its tint's box and radius, captures the held state, then cancels. */
async function heldTint(page: Page, control: Locator, info: TestInfo, name: string) {
  await control.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const bounds = await control.boundingBox();
  if (!bounds) throw new Error('Expected a visible control');
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  const layer = control.getByTestId('forge-press-state-layer');
  await expect(layer).toBeVisible();
  await page.waitForTimeout(200);
  const tint = (await layer.boundingBox())!;
  const radius = await layer.evaluate((node) => getComputedStyle(node).borderTopLeftRadius);
  const background = await control.evaluate((node) => getComputedStyle(node).backgroundColor);
  await page.screenshot({ path: info.outputPath(`${name}-held.png`) });
  // Swallow the release's click: a cancelled hold must not activate, and react-native-web
  // otherwise delivers it to a pointer captured by a surrounding gesture handler.
  await page.evaluate(() => {
    const swallow = (event: Event) => {
      event.stopPropagation();
      event.preventDefault();
    };
    window.addEventListener('click', swallow, { capture: true });
    setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 150);
  });
  await page.mouse.move(1, 1, { steps: 3 });
  await page.mouse.up();
  await expect(layer).toHaveCount(0);
  await page.screenshot({ path: info.outputPath(`${name}-released.png`) });
  return { bounds, tint, radius, background };
}

for (const appearance of ['light', 'dark'] as const) {
  test(`${appearance} dashboard tiles that open a screen tint the whole card`, async ({
    page,
  }, info) => {
    await seed(page, appearance, false, ['last-workout', 'muscle-heatmap', 'calendar']);
    for (const [testID, name] of [
      ['dashboard-last-workout', 'Open Shape check'],
      ['dashboard-muscle-heatmap', 'Open muscle heatmap'],
      ['dashboard-calendar', 'Open calendar'],
    ] as const) {
      const card = page.getByTestId(testID);
      const control = card.getByRole('button', { name, exact: true });
      const held = await heldTint(page, control, info, testID);
      const cardBounds = (await card.boundingBox())!;
      // The card clips the tint to its own outline: it covers the card, not an inset square.
      const visible = {
        left: Math.max(held.tint.x, cardBounds.x),
        top: Math.max(held.tint.y, cardBounds.y),
        right: Math.min(held.tint.x + held.tint.width, cardBounds.x + cardBounds.width),
        bottom: Math.min(held.tint.y + held.tint.height, cardBounds.y + cardBounds.height),
      };
      expect(visible.left - cardBounds.x).toBeLessThanOrEqual(1);
      expect(visible.top - cardBounds.y).toBeLessThanOrEqual(1);
      expect(cardBounds.x + cardBounds.width - visible.right).toBeLessThanOrEqual(1);
      expect(cardBounds.y + cardBounds.height - visible.bottom).toBeLessThanOrEqual(1);
      expect(held.radius).toBe(await card.evaluate((node) => getComputedStyle(node).borderTopLeftRadius));
      await expect(card).toHaveCSS('overflow', 'hidden');
    }
    await expect(page.getByRole('button', { name: 'Edit dashboard', exact: true })).toBeVisible();
  });

  test(`${appearance} wheel rows keep one rounded local tint`, async ({
    page,
  }, info) => {
    await seed(page, appearance, true, undefined, true);
    await page.getByRole('button', { name: 'Start rest timer', exact: true }).click();
    const row = page.getByRole('button', { name: 'Rest duration 01:05', exact: true });
    const wheel = await heldTint(page, row, info, 'rest-wheel-row');
    // One rounded tint over the row, with no extra square fill painted beneath it.
    expect(wheel.radius).toBe('12px');
    expect(wheel.background).toBe('rgba(0, 0, 0, 0)');
    expect(Math.abs(wheel.tint.width - wheel.bounds.width)).toBeLessThanOrEqual(1);
    // The cancelled hold neither selected the row nor started the timer.
    await expect(page.getByRole('button', { name: 'Start rest timer', exact: true }).last()).toBeVisible();
  });

  test(`${appearance} the editor's off-plan row keeps a rounded tint with space around it`, async ({
    page,
  }, info) => {
    await seed(page, appearance, true);
    await page.getByRole('button', { name: 'Edit live workout', exact: true }).click();
    const offPlan = page.getByRole('switch', {
      name: "Don't count this workout toward next-session targets",
      exact: true,
    });
    const label = await offPlan.getByText('Off-plan session', { exact: true }).boundingBox();
    const held = await heldTint(page, offPlan, info, 'off-plan-row');
    expect(held.radius).toBe('12px');
    // The rounded tint leaves space around the label instead of ending flush against it.
    expect(label!.x - held.tint.x).toBeGreaterThanOrEqual(6);
    await expect(offPlan).not.toHaveAttribute('aria-checked', 'true');
  });

  test(`${appearance} lone heatmap Edit view uses the centred circular tint`, async ({
    page,
  }, info) => {
    await seed(page, appearance);
    await page.getByRole('tab', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Muscle heatmap', exact: true }).click();
    await pressShape(
      page,
      page.getByRole('button', { name: 'Edit view', exact: true }),
      info,
      'heatmap-edit-view',
      40,
      20,
    );
  });
}
