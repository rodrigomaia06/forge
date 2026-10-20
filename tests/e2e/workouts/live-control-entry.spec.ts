import { expect, test, type Page } from '@playwright/test';
import { exerciseCatalogById } from '../../../src/data/exerciseCatalog';
import { createExerciseSnapshot } from '../../../src/domain/exercises/exerciseSnapshot';
import type { Workout } from '../../../src/types';

const bench = [...exerciseCatalogById.values()].find(
  (item) => item.name === 'Barbell Bench Press',
)!;

async function seed(page: Page, appearance: 'light' | 'dark', showRestTimer = true) {
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
    ({ workout, appearance, showRestTimer }) => {
      if (sessionStorage.getItem('live-control-entry-seeded')) return;
      sessionStorage.setItem('live-control-entry-seeded', 'yes');
      localStorage.setItem(
        '@forge/settings-preferences',
        JSON.stringify({ appearance, showRestTimer }),
      );
      localStorage.setItem('@forge/active-workout', JSON.stringify(workout));
    },
    { workout, appearance, showRestTimer },
  );
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Finish workout', exact: true })).toBeVisible();
}

for (const appearance of ['light', 'dark'] as const) {
  test(`${appearance} rest control returns when its saved setting is enabled`, async ({ page }, info) => {
    await seed(page, appearance, false);
    await expect(page.getByRole('button', { name: 'Open workout duration', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start rest timer', exact: true })).toHaveCount(0);
    await page.screenshot({ path: info.outputPath('rest-disabled-elapsed-only.png') });
    await page.getByRole('tab', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'General', exact: true }).click();
    const toggle = page.getByRole('switch', { name: 'Rest timer', exact: true });
    await toggle.click();
    await page.getByRole('button', { name: 'Back to Settings', exact: true }).click();
    await page.getByRole('tab', { name: 'Workout', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Start rest timer', exact: true })).toBeVisible();
    await page.waitForTimeout(300);
    await page.screenshot({ path: info.outputPath('rest-enabled-restored.png') });
  });

  test(`${appearance} next-session targets remain reachable in a keyboard-sized viewport`, async ({ page }, info) => {
    await seed(page, appearance);
    const viewport = page.viewportSize()!;
    await page.setViewportSize({ width: viewport.width, height: 420 });
    await page.getByLabel('Open details for set 1', { exact: true }).click();
    const sheet = page.getByTestId('set-details-sheet');
    const kg = sheet.getByRole('textbox', { name: 'Next-time kg target for set 1' });
    const reps = sheet.getByRole('textbox', { name: 'Next-time reps target for set 1' });
    await kg.fill('25');
    await reps.fill('8');
    await reps.scrollIntoViewIfNeeded();
    await expect(reps).toBeFocused();
    await expect(kg).toHaveValue('25');
    await expect(reps).toHaveValue('8');
    await expect(sheet).toHaveCSS('padding-bottom', '0px');
    await page.waitForTimeout(350);
    const [sheetBox, inputBox] = await Promise.all([sheet.boundingBox(), sheet.getByTestId('set-next-session-section').boundingBox()]);
    expect(inputBox!.y).toBeGreaterThanOrEqual(sheetBox!.y);
    expect(inputBox!.y + inputBox!.height).toBeLessThanOrEqual(sheetBox!.y + sheetBox!.height);
    await page.screenshot({ path: info.outputPath('targets-reduced-viewport.png') });
  });

  test(`${appearance} set editor restores the kind picker and keeps comments stable`, async ({ page }, info) => {
    await seed(page, appearance);
    await page.getByLabel('Open details for set 1', { exact: true }).click();
    const sheet = page.getByTestId('set-details-sheet');
    await expect(sheet.getByRole('radiogroup', { name: 'Set type' })).toHaveCount(0);
    await sheet.getByRole('button', { name: 'Change set kind', exact: true }).click();
    const choices = sheet.getByRole('radiogroup', { name: 'Set type' });
    await expect(choices.getByRole('radio')).toHaveCount(4);
    await page.waitForTimeout(300);
    await page.screenshot({ path: info.outputPath('restored-set-kind-picker.png') });
    await choices.getByRole('radio', { name: 'Back-Off', exact: true }).click();
    await expect(sheet.getByRole('button', { name: 'Clear set kind', exact: true })).toBeVisible();
    await sheet.getByRole('radio', { name: 'RIR 2', exact: true }).click();
    const selected = sheet.getByRole('radio', { name: 'RIR 2', exact: true });
    await expect(selected).toHaveCSS('background-color', appearance === 'light' ? 'rgb(222, 222, 222)' : 'rgb(43, 47, 52)');
    const comment = sheet.getByRole('textbox', { name: 'Comment for set 1' });
    await expect(comment).toHaveAttribute('spellcheck', 'false');
    await expect(comment).toHaveAttribute('autocomplete', 'off');
    const height = (await comment.boundingBox())!.height;
    const sheetHeight = (await sheet.boundingBox())!.height;
    const text = 'Keep the same grip. Pause at the chest. '.repeat(20);
    await comment.fill(text);
    await expect(comment).toHaveValue(text);
    await page.waitForTimeout(300);
    expect((await comment.boundingBox())!.height).toBe(height);
    expect((await sheet.boundingBox())!.height).toBe(sheetHeight);
    await page.screenshot({ path: info.outputPath('set-editor-long-comment.png') });
    await comment.fill('Pause at the chest.');
    await selected.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: info.outputPath('set-editor-forge.png') });
    await expect(sheet.getByText(/Autosaved|FORGE v|Solid buffer/i)).toHaveCount(0);
  });

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
    await expect(layer).toHaveCSS('border-radius', '20px');
    await expect(layer).toHaveCSS('width', '40px');
    await expect(layer).toHaveCSS('height', '40px');
    await page.screenshot({ path: info.outputPath('live-more-circle-pressed.png') });
    await page.mouse.up();
    await expect(page.getByRole('button', { name: 'Tracking', exact: true })).toBeVisible();
    const close = page.getByRole('button', { name: 'Close Exercise options', exact: true });
    await close.hover();
    const closeBounds = (await close.boundingBox())!;
    expect(closeBounds.width).toBe(44);
    expect(closeBounds.height).toBe(44);
    await page.mouse.move(closeBounds.x + 22, closeBounds.y + 22);
    await page.mouse.down();
    await expect(close.getByTestId('forge-press-state-layer')).toHaveCSS('width', '40px');
    await expect(close.getByTestId('forge-press-state-layer')).toHaveCSS('height', '40px');
    await page.screenshot({ path: info.outputPath('sheet-close-circle-pressed.png') });
    await page.mouse.up();
  });

  test(`${appearance} live timer actions fill their strip`, async ({ page }, info) => {
    await seed(page, appearance);
    const elapsed = page.getByRole('button', { name: 'Open workout duration', exact: true });
    const rest = page.getByRole('button', { name: 'Start rest timer', exact: true });
    const panel = elapsed.locator('..');
    await expect(elapsed.getByText('Elapsed', { exact: true })).toBeVisible();
    await expect(elapsed.getByText(/\d+:\d{2}/)).toBeVisible();
    await expect(rest.getByText('Rest', { exact: true })).toBeVisible();
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
    await page.getByRole('button', { name: 'Start rest timer', exact: true }).last().click();
    await page.getByRole('button', { name: 'Close rest timer', exact: true }).last().click();
    const running = page.getByRole('button', { name: /Rest timer, \d+ seconds remaining/ });
    await expect(running.getByText(/\d+:\d{2}/)).toBeVisible();
    await expect(running.getByText('Rest', { exact: true })).toBeVisible();
    await expect(running).toHaveCSS('height', '44px');
    await page.waitForTimeout(300);
    await page.screenshot({ path: info.outputPath('live-timer-running.png') });
  });
}
