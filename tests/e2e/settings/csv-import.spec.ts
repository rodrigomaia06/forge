import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseWorkoutCsv } from '../../../src/data/csvImport/parse';
import { sourceLabels } from '../../../src/data/csvImport/types';

const header =
  'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe';
const row = (name: string, weight = '50', exercise = 'Mystery Lift') =>
  `${name},2026-09-20 08:00:00,2026-09-20 09:00:00,Session note,${exercise},,Exercise note,0,normal,${weight},8,,,8`;
const fixture = `${header}\n${row('CSV morning')}\n${row('Broken session', 'bad')}`;
async function open(page: Page, appearance: 'light' | 'dark') {
  await page.addInitScript(
    (appearance) =>
      localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance })),
    appearance,
  );
  await page.goto('/');
  await page.getByRole('tab', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Backup & Export', exact: true }).click();
  await page.getByRole('button', { name: 'Import from another app', exact: true }).click();
}
async function pick(page: Page, text: string) {
  let source = 'Hevy';
  try {
    source = sourceLabels[parseWorkoutCsv(text).source];
  } catch {
    /* Invalid files still go through validation. */
  }
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: source, exact: true }).click();
  await (
    await chooser
  ).setFiles({ name: 'workout-history.csv', mimeType: 'text/csv', buffer: Buffer.from(text) });
}
async function capture(page: Page, info: TestInfo, name: string) {
  await page.waitForTimeout(300);
  await page.screenshot({ path: info.outputPath(`${name}.png`) });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
}
async function advance(page: Page) {
  await page.getByRole('button', { name: 'Continue CSV import', exact: true }).click();
}
async function asCustom(page: Page) {
  await page.getByRole('button', { name: 'Mystery Lift', exact: true }).click();
  await page.getByRole('button', { name: 'Keep “Mystery Lift” as custom', exact: true }).click();
}
async function chooseBench(page: Page, keyboard = false) {
  const library = page.getByRole('button', { name: 'Choose from library', exact: true });
  if (keyboard) await library.press('Enter');
  else await library.click();
  await page
    .getByRole('textbox', { name: 'Search exercises', exact: true })
    .fill('Barbell Bench Press');
  const bench = page.getByRole('checkbox', { name: 'Bench Press, variation', exact: true });
  if (keyboard) await bench.press('Enter');
  else await bench.click();
  const confirm = page.getByRole('button', { name: 'Confirm selected exercises', exact: true });
  if (keyboard) await confirm.press('Enter');
  else await confirm.click();
}
for (const appearance of ['light', 'dark'] as const) {
  test(`${appearance} common movement names auto-match while ambiguous variants need a choice`, async ({
    page,
  }, info) => {
    await open(page, appearance);
    const names = [
      'Bulgarian split squat (Dumbbell)',
      'Crunch (Machine)',
      'Bicep curl (Dumbbell)',
      'Ab wheel',
      'Incline Bench Press (Barbell)',
      'Lateral raise (Dumbbell)',
      'Rear delt fly (Machine)',
      'Tricep extension',
    ];
    await pick(
      page,
      `${header}\n${names.map((name) => row('Morning workout', '20', name)).join('\n')}`,
    );
    await advance(page);
    await expect(page.getByText('1 exercise to choose', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tricep extension', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: names[0], exact: true })).toHaveCount(0);
    await capture(page, info, 'common-names-unresolved-only');
    await page.getByRole('button', { name: 'Show all exercises', exact: true }).click();
    await expect(page.getByRole('button', { name: names[0], exact: true })).toBeVisible();
    await capture(page, info, 'common-names-review');
  });
  test(`${appearance} app source buttons stay joined and explain a mismatched export`, async ({
    page,
  }, info) => {
    await open(page, appearance);
    const hevy = page.getByRole('button', { name: 'Hevy', exact: true });
    const strong = page.getByRole('button', { name: 'Strong', exact: true });
    const first = await hevy.boundingBox(),
      second = await strong.boundingBox();
    expect(Math.abs(second!.y - (first!.y + first!.height))).toBeLessThanOrEqual(1);
    await capture(page, info, 'app-source-buttons');
    const chooser = page.waitForEvent('filechooser');
    await hevy.press('Enter');
    await (await chooser).setFiles(resolve('tests/fixtures/csv-import/strong-classic-sample.csv'));
    await expect(page.getByRole('alert')).toContainText('This is a Strong export. Choose Strong');
    await capture(page, info, 'wrong-app-export');
    await pick(
      page,
      readFileSync(resolve('tests/fixtures/csv-import/strong-classic-sample.csv'), 'utf8'),
    );
    await expect(page.getByText('Strong CSV detected', { exact: true })).toBeVisible();
  });
  test(`${appearance} prioritizes unresolved exercises and reuses the picker without saving on cancel`, async ({
    page,
  }, info) => {
    await open(page, appearance);
    await pick(page, readFileSync(resolve('tests/fixtures/csv-import/hevy-sample.csv'), 'utf8'));
    await advance(page);
    await expect(page.getByText('1 exercise to choose', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pull Up', exact: true })).toHaveCount(0);
    await capture(page, info, 'unresolved-exercises');
    await page.getByRole('button', { name: 'Show all exercises', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pull Up', exact: true })).toBeVisible();
    await expect(page.getByText(/^Matched:|^Remembered match:/)).toHaveCount(0);
    const benchRow = await page
      .getByRole('button', { name: 'Bench Press (Barbell)', exact: true })
      .boundingBox();
    const customRow = await page
      .getByRole('button', { name: 'My Custom Cable Row', exact: true })
      .boundingBox();
    expect(benchRow).not.toBeNull();
    expect(customRow).not.toBeNull();
    expect(Math.abs(benchRow!.y - (customRow!.y + customRow!.height))).toBeLessThanOrEqual(1);
    await capture(page, info, 'grouped-exercises');
    await page.getByRole('button', { name: 'Bench Press (Barbell)', exact: true }).click();
    await chooseBench(page);
    await page.getByRole('button', { name: 'My Custom Cable Row', exact: true }).click();
    await capture(page, info, 'exercise-choices');
    await page.getByRole('button', { name: 'Choose from library', exact: true }).click();
    await expect(page.getByTestId('add-exercise-catalogue')).toBeVisible();
    await page.getByRole('textbox', { name: 'Search exercises', exact: true }).fill('pull up');
    await page
      .getByRole('button', { name: /Pull-Up & \d+ variations/ })
      .first()
      .click();
    await page.getByRole('checkbox', { name: 'Pull-Up, Wide', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Pull-Up, Neutral', exact: true }).click();
    await capture(page, info, 'shared-exercise-picker');
    const customBefore = await page.evaluate(() => localStorage.getItem('@forge/custom-exercises'));
    await page.getByRole('button', { name: 'Confirm selected exercises', exact: true }).click();
    const chooser = page.getByTestId('variation-output-chooser');
    await expect(chooser).toBeVisible();
    const derived = chooser
      .getByRole('checkbox')
      .filter({ hasText: /Wide.*Neutral|Neutral.*Wide/ });
    await derived.click();
    await expect(chooser.getByRole('checkbox', { checked: true })).toHaveCount(1);
    await chooser.getByRole('checkbox').first().click();
    await expect(chooser.getByRole('checkbox', { checked: true })).toHaveCount(1);
    await derived.click();
    await capture(page, info, 'single-exercise-variation-choice');
    await page.getByRole('button', { name: 'Confirm resolved exercises', exact: true }).click();
    await expect(page.getByText('Review exercises', { exact: true })).toBeVisible();
    await capture(page, info, 'resolved-exercises');
    expect(await page.evaluate(() => localStorage.getItem('@forge/custom-exercises'))).toBe(
      customBefore,
    );
    await page.getByRole('button', { name: 'Cancel CSV import', exact: true }).click();
    expect(await page.evaluate(() => localStorage.getItem('@forge/custom-exercises'))).toBe(
      customBefore,
    );
    expect(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem('@forge/completed-workouts') ?? '[]'),
      ),
    ).toEqual([]);
  });
  test(`${appearance} uses grouped review rows and a readable import summary`, async ({
    page,
  }, info) => {
    await open(page, appearance);
    await capture(page, info, 'export-instructions-list');
    await pick(page, `${header}\n${row('Morning workout')}\n${row('Evening workout')}`);
    await advance(page);
    await asCustom(page);
    await advance(page);
    const first = await page
      .getByRole('checkbox', { name: 'Morning workout', exact: true })
      .boundingBox();
    const second = await page
      .getByRole('checkbox', { name: 'Evening workout', exact: true })
      .boundingBox();
    expect(Math.abs(second!.y - (first!.y + first!.height))).toBeLessThanOrEqual(1);
    await capture(page, info, 'joined-workout-list');
    await page.getByRole('button', { name: 'Review 2 workouts', exact: true }).click();
    const dialog = page.getByTestId('csv-import-confirmation');
    await expect(dialog.getByText('Add workouts', { exact: true })).toBeVisible();
    await expect(dialog.getByText('2', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Create custom exercises', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Replace workouts', { exact: true })).toHaveCount(0);
    await expect(dialog.getByText('Duplicates skipped', { exact: true })).toHaveCount(0);
    await expect(dialog.getByText('Incomplete workouts excluded', { exact: true })).toHaveCount(0);
    const confirm = dialog.getByRole('button', { name: 'Import workouts', exact: true });
    const bounds = await confirm.boundingBox();
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    await capture(page, info, 'two-workouts-one-custom-confirmation');
    await dialog.getByRole('button', { name: 'Back to review', exact: true }).press('Enter');
    await expect(
      page.getByRole('checkbox', { name: 'Morning workout', exact: true }),
    ).toBeChecked();
    await expect(
      page.getByRole('checkbox', { name: 'Evening workout', exact: true }),
    ).toBeChecked();
    await page.getByRole('button', { name: 'Review 2 workouts', exact: true }).click();
    await page.getByRole('button', { name: 'Import workouts', exact: true }).press('Enter');
    await expect(page.getByText('Import complete', { exact: true })).toBeVisible();
    await capture(page, info, 'two-workouts-summary-success');
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem('@forge/completed-workouts') ?? '[]').length,
      ),
    ).toBe(2);
  });
  test(`${appearance} keeps every import outcome readable in a full confirmation`, async ({
    page,
  }, info) => {
    await open(page, appearance);
    await pick(page, `${header}\n${row('Changed workout')}\n${row('Duplicate workout')}`);
    await advance(page);
    await asCustom(page);
    await advance(page);
    await page.getByRole('button', { name: 'Review 2 workouts', exact: true }).click();
    await page.getByRole('button', { name: 'Import workouts', exact: true }).click();
    await expect(page.getByText('Import complete', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.getByRole('button', { name: 'Import from another app', exact: true }).click();
    await pick(
      page,
      `${header}\n${row('Changed workout', '55')}\n${row('Duplicate workout')}\n${row('New workout', '70', 'New custom exercise')}\n${row('Invalid workout', 'bad')}`,
    );
    await page.getByRole('checkbox', { name: 'Exclude 1 incomplete workout', exact: true }).click();
    await advance(page);
    await page.getByRole('button', { name: 'New custom exercise', exact: true }).click();
    await page
      .getByRole('button', { name: 'Keep “New custom exercise” as custom', exact: true })
      .click();
    await advance(page);
    await page.getByRole('button', { name: 'Keep existing session', exact: true }).click();
    await page.getByRole('radio', { name: /^Replace/ }).click();
    await page.getByRole('button', { name: 'Review 2 workouts', exact: true }).click();
    const dialog = page.getByTestId('csv-import-confirmation');
    for (const label of [
      'Add workouts',
      'Replace workouts',
      'Duplicates skipped',
      'Incomplete workouts excluded',
      'Create custom exercises',
      'Save exercise matches',
    ]) {
      await expect(dialog.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(dialog.getByText('1', { exact: true })).toHaveCount(6);
    await expect(
      dialog.getByRole('button', { name: 'Import workouts', exact: true }),
    ).toBeInViewport({ ratio: 1 });
    await capture(page, info, 'all-outcomes-confirmation');
    await dialog.getByRole('button', { name: 'Import workouts', exact: true }).click();
    await expect(page.getByText('Import complete', { exact: true })).toBeVisible();
    const workouts = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('@forge/completed-workouts') ?? '[]'),
    );
    expect(workouts).toHaveLength(3);
    expect(
      workouts.find((workout: { name: string }) => workout.name === 'Changed workout').exercises[0]
        .sets[0].weight,
    ).toBe('55');
    await capture(page, info, 'all-outcomes-success');
  });
  test(`${appearance} reviews all five user-provided CSV samples`, async ({ page }, info) => {
    await open(page, appearance);
    for (const [name, source, count] of [
      ['hevy', 'Hevy', 2],
      ['strong-classic', 'Strong', 1],
      ['strong-modern-semicolon', 'Strong', 1],
      ['fitnotes-android', 'FitNotes Android', 1],
      ['fitnotes-ios', 'FitNotes iOS', 2],
    ] as const) {
      await pick(
        page,
        readFileSync(resolve('tests/fixtures/csv-import', `${name}-sample.csv`), 'utf8'),
      );
      if (name === 'strong-classic') {
        await page.getByRole('button', { name: 'Choose source weight unit', exact: true }).click();
        await page.getByRole('radio', { name: 'Kilograms (kg)', exact: true }).click();
      }
      await expect(page.getByText(`${source} CSV detected`, { exact: true })).toBeVisible();
      await expect(
        page.getByText(`${count} valid workout${count === 1 ? '' : 's'}`, { exact: true }),
      ).toBeVisible();
      await expect(page.getByText('No validation problems', { exact: true })).toBeVisible();
      await capture(page, info, `${name}-sample-detected`);
      await advance(page);
      await expect(
        page.getByText(/exercise(?:s)? to choose|Review exercises/, { exact: false }),
      ).toBeVisible();
      await capture(page, info, `${name}-sample-matches`);
      await page.getByRole('button', { name: 'Back in CSV import', exact: true }).click();
      await page.getByRole('button', { name: 'Back in CSV import', exact: true }).click();
    }
    const feet = readFileSync(
      resolve('tests/fixtures/csv-import/fitnotes-ios-sample.csv'),
      'utf8',
    ).replace('5,km,30:00', '100,ft,30:00');
    await pick(page, feet);
    await expect(page.getByText('2 valid workouts', { exact: true })).toBeVisible();
    await expect(page.getByText('No validation problems', { exact: true })).toBeVisible();
    await capture(page, info, 'fitnotes-ios-feet-detected');
    expect(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem('@forge/completed-workouts') ?? '[]'),
      ),
    ).toEqual([]);
  });
  test(`${appearance} mixed imports preserve the existing History and set details presentation`, async ({
    page,
  }, info) => {
    await open(page, appearance);
    await pick(
      page,
      `${header}\nMixed metrics,2026-09-20 08:00:00,2026-09-20 09:00:00,,Timed carry,,,0,normal,50,8,1,30,8`,
    );
    await advance(page);
    await page.getByRole('button', { name: 'Timed carry', exact: true }).click();
    await page.getByRole('button', { name: 'Keep “Timed carry” as custom', exact: true }).click();
    await advance(page);
    await page.getByRole('button', { name: 'Review 1 workout', exact: true }).click();
    await page.getByRole('button', { name: 'Import workouts', exact: true }).click();
    await expect(page.getByText('Import complete', { exact: true })).toBeVisible();
    await page.goto('/');
    await page.getByRole('tab', { name: 'History', exact: true }).click();
    await page.getByRole('button', { name: 'Open Mixed metrics', exact: true }).click();
    await page.getByRole('button', { name: 'Expand Timed carry', exact: true }).click();
    await expect(page.getByText('Weight: 50 kg · Reps: 8', { exact: true })).toHaveCount(0);
    await capture(page, info, 'mixed-measurements-history');
    await page.getByRole('button', { name: 'Open details for set 1', exact: true }).click();
    const imported = page.getByTestId('set-imported-measurements');
    await expect(imported).toHaveCount(0);
    await expect(page.getByText('Imported measurements', { exact: true })).toHaveCount(0);
    await capture(page, info, 'mixed-measurements-set-details');
  });
  test(`${appearance} duplicate-only mapping changes survive failure, retry and reimport`, async ({
    page,
  }, info) => {
    const text = `${header}\n${row('Mapping session')}`;
    await open(page, appearance);
    await pick(page, text);
    await advance(page);
    await asCustom(page);
    await advance(page);
    await page.getByRole('button', { name: 'Review 1 workout', exact: true }).click();
    await page.getByRole('button', { name: 'Import workouts', exact: true }).click();
    await expect(page.getByText('Import complete', { exact: true })).toBeVisible();
    const before = await page.evaluate(() => localStorage.getItem('@forge/completed-workouts'));
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.getByRole('button', { name: 'Import from another app', exact: true }).click();
    await pick(page, text);
    await advance(page);
    await page.getByRole('button', { name: 'Mystery Lift', exact: true }).click();
    await chooseBench(page);
    await advance(page);
    await expect(page.getByText(/Already imported/)).toBeVisible();
    await capture(page, info, 'mapping-only-review');
    await page.getByRole('button', { name: 'Review 1 exercise match', exact: true }).click();
    await expect(page.getByText('Save matches?', { exact: true })).toBeVisible();
    await capture(page, info, 'mapping-only-confirmation');
    await page.getByRole('button', { name: 'Back to review', exact: true }).click();
    expect(await page.evaluate(() => localStorage.getItem('@forge/completed-workouts'))).toBe(
      before,
    );
    const mappingBefore = await page.evaluate(() =>
      localStorage.getItem('@forge/csv-exercise-mappings-v1'),
    );
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === '@forge/csv-exercise-mappings-v1') {
          Storage.prototype.setItem = original;
          throw new Error('Storage full');
        }
        return original.call(this, key, value);
      };
    });
    await page.getByRole('button', { name: 'Review 1 exercise match', exact: true }).click();
    await page.getByRole('button', { name: 'Save matches', exact: true }).click();
    await expect(page.getByText('Storage full', { exact: true })).toBeVisible();
    await capture(page, info, 'mapping-only-failure');
    expect(await page.evaluate(() => localStorage.getItem('@forge/csv-exercise-mappings-v1'))).toBe(
      mappingBefore,
    );
    await page.getByRole('button', { name: 'Review 1 exercise match', exact: true }).click();
    await page.getByRole('button', { name: 'Save matches', exact: true }).click();
    await expect(page.getByText('Matches saved', { exact: true })).toBeVisible();
    await expect(page.getByText('Workouts added', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Workouts replaced', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
    await capture(page, info, 'mapping-only-success');
    expect(await page.evaluate(() => localStorage.getItem('@forge/completed-workouts'))).toBe(
      before,
    );
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.getByRole('button', { name: 'Import from another app', exact: true }).click();
    await pick(page, text);
    await advance(page);
    await expect(page.getByText('Barbell Bench Press', { exact: true })).toBeVisible();
    await capture(page, info, 'mapping-only-remembered');
    await page.getByRole('button', { name: 'Cancel CSV import', exact: true }).click();
    expect(await page.evaluate(() => localStorage.getItem('@forge/completed-workouts'))).toBe(
      before,
    );
  });
  test(`${appearance} shows Strive database import availability beside CSV sources`, async ({
    page,
  }, info) => {
    await open(page, appearance);
    const source = page.getByTestId('csv-source-icon-strive');
    await source.scrollIntoViewIfNeeded();
    await expect(source).toBeVisible();
    const backup = page.getByRole('button', { name: 'Strive', exact: true });
    await backup.scrollIntoViewIfNeeded();
    await expect(backup).toBeDisabled();
    const supporting = backup.getByText(/Available in the iOS or Android app/);
    await expect(supporting).toBeVisible();
    const reference = page
      .getByRole('button', { name: 'Strong', exact: true })
      .getByText('Settings → Export Strong Data.');
    for (const property of ['color', 'font-size', 'font-weight', 'line-height']) {
      await expect(supporting).toHaveCSS(
        property,
        await reference.evaluate(
          (element, property) => getComputedStyle(element).getPropertyValue(property),
          property,
        ),
      );
    }
    const hevy = page.getByRole('button', { name: 'Hevy', exact: true });
    await expect(backup.getByText('Strive', { exact: true })).toHaveCSS(
      'color',
      await hevy
        .getByText('Hevy', { exact: true })
        .evaluate((element) => getComputedStyle(element).color),
    );
    const iconColor = await page
      .getByTestId('csv-source-icon-hevy')
      .locator('svg')
      .evaluate((element) => getComputedStyle(element).color);
    await expect(source.locator('svg')).toHaveCSS('color', iconColor);
    await capture(page, info, 'strive-backup-availability');
    await expect(page.getByRole('button', { name: 'Hevy', exact: true })).toBeEnabled();
    await expect(backup.getByText(/Choose an exported .db or .sqlite backup/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Choose CSV file', exact: true })).toHaveCount(0);
  });
  test(`${appearance} shows source icons for each supported CSV format`, async ({ page }, info) => {
    await open(page, appearance);
    const sources = [
      ['hevy', `${header}\n${row('Hevy session')}`],
      [
        'strong',
        'Date,Workout Name,Duration,Exercise Name,Set Order,Weight (kg),Reps\n2026-09-20 08:00:00,Strong session,1200,Mystery Lift,1,50,8',
      ],
      [
        'fitnotes',
        'Date,Exercise,Category,Weight,Weight Unit,Reps\n2026-09-20,Mystery Lift,Strength,50,kg,8',
      ],
      [
        'fitnotes-ios',
        'Date,Exercise,Category,Weight(kg),Reps\n2026-09-20,Mystery Lift,Strength,50,8',
      ],
    ];
    for (const [source] of sources)
      await expect(page.getByTestId(`csv-source-icon-${source}`)).toBeVisible();
    await capture(page, info, 'source-icons-instructions');
    for (const [source, text] of sources) {
      await pick(page, text);
      await expect(page.getByTestId(`csv-source-icon-${source}`)).toBeVisible();
      await expect(page.getByText('1 valid workout', { exact: true })).toBeVisible();
      await capture(page, info, `source-icon-${source}-detected`);
      await page.getByRole('button', { name: 'Back in CSV import', exact: true }).click();
    }
  });
  test(`${appearance} keyboard operates checkboxes, matching search and conflict dismissal`, async ({
    page,
  }) => {
    await open(page, appearance);
    await pick(page, fixture);
    const acknowledgment = page.getByRole('checkbox', {
      name: 'Exclude 1 incomplete workout',
      exact: true,
    });
    await acknowledgment.focus();
    await acknowledgment.press('Space');
    await expect(acknowledgment).toBeChecked();
    await acknowledgment.press('Enter');
    await expect(acknowledgment).not.toBeChecked();
    await acknowledgment.press('Space');
    await advance(page);
    await page.getByRole('button', { name: 'Mystery Lift', exact: true }).press('Enter');
    await chooseBench(page, true);
    await advance(page);
    const session = page.getByRole('checkbox', { name: 'CSV morning', exact: true });
    await session.press('Space');
    await expect(session).not.toBeChecked();
    await session.press('Space');
    await page.getByRole('button', { name: 'Review 1 workout', exact: true }).press('Enter');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('csv-import-confirmation')).toHaveCount(0);
  });
  test(`${appearance} reviews errors, custom matches, save failure, retry, results and remembered matches`, async ({
    page,
  }, info) => {
    await open(page, appearance);
    await capture(page, info, 'file-instructions');
    await pick(page, fixture);
    await expect(page.getByText('Hevy CSV detected', { exact: true })).toBeVisible();
    await expect(page.getByText('1 valid workout', { exact: true })).toBeVisible();
    await expect(page.getByText('Row 3 · Weight', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue CSV import' })).toBeDisabled();
    await capture(page, info, 'detection-and-errors');
    await page.getByRole('checkbox', { name: 'Exclude 1 incomplete workout', exact: true }).click();
    await advance(page);
    await capture(page, info, 'uncertain-exercise');
    await page.getByRole('button', { name: 'Mystery Lift', exact: true }).click();
    await capture(page, info, 'catalogue-or-custom');
    await page.getByRole('button', { name: 'Keep “Mystery Lift” as custom', exact: true }).click();
    await advance(page);
    await capture(page, info, 'session-selection');
    await page.getByRole('button', { name: 'Review 1 workout', exact: true }).click();
    await capture(page, info, 'confirmation');
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === '@forge/custom-exercises') {
          Storage.prototype.setItem = original;
          throw new Error('Storage full');
        }
        return original.call(this, key, value);
      };
    });
    await page.getByRole('button', { name: 'Import workouts', exact: true }).click();
    await expect(page.getByText('Storage full', { exact: true })).toBeVisible();
    await expect(page.getByTestId('csv-import-confirmation')).toHaveCount(0);
    await capture(page, info, 'save-failure-draft-kept');
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem('@forge/completed-workouts') ?? '[]').length,
      ),
    ).toBe(0);
    await page.getByRole('button', { name: 'Review 1 workout', exact: true }).click();
    await page.getByRole('button', { name: 'Import workouts', exact: true }).click();
    await expect(page.getByText('Import complete', { exact: true })).toBeVisible();
    await capture(page, info, 'success');
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem('@forge/completed-workouts') ?? '[]').length,
      ),
    ).toBe(1);
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.getByRole('button', { name: 'Import from another app', exact: true }).click();
    await pick(page, `${header}\n${row('CSV morning')}`);
    await advance(page);
    await expect(page.getByRole('button', { name: 'Mystery Lift', exact: true })).toBeVisible();
    await advance(page);
    await expect(page.getByText(/Already imported/)).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Deselect all workouts', exact: true }),
    ).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Review 0 workouts' })).toBeDisabled();
    await capture(page, info, 'duplicate-session');
  });
  test(`${appearance} reviews changed sessions and preserves separate same-day sessions`, async ({
    page,
  }, info) => {
    await open(page, appearance);
    await pick(page, `${header}\n${row('CSV morning')}`);
    await advance(page);
    await asCustom(page);
    await advance(page);
    await page.getByRole('button', { name: 'Review 1 workout' }).click();
    await page.getByRole('button', { name: 'Import workouts', exact: true }).click();
    await expect(page.getByText('Import complete', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.getByRole('button', { name: 'Import from another app', exact: true }).click();
    await pick(page, `${header}\n${row('CSV morning', '55')}\n${row('CSV evening', '60')}`);
    await advance(page);
    await advance(page);
    await expect(page.getByText(/Changed session/)).toBeVisible();
    await capture(page, info, 'changed-and-same-day-sessions');
    await page.getByRole('button', { name: 'View changes for CSV morning', exact: true }).click();
    await expect(page.getByText(/On device: 50 kg/)).toBeVisible();
    await expect(page.getByText(/CSV: 55 kg/)).toBeVisible();
    await capture(page, info, 'changed-session-details');
    await page.getByRole('button', { name: 'Hide changes for CSV morning', exact: true }).click();
    await page.getByRole('button', { name: 'Keep existing session', exact: true }).click();
    await capture(page, info, 'conflict-choices');
    await page.getByRole('radio', { name: /^Replace/ }).click();
    await page.getByRole('button', { name: 'Review 2 workouts' }).click();
    await page.getByRole('button', { name: 'Import workouts', exact: true }).click();
    await expect(page.getByText('Workouts added', { exact: true })).toBeVisible();
    await expect(page.getByText('Workouts replaced', { exact: true })).toBeVisible();
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem('@forge/completed-workouts') ?? '[]').length,
      ),
    ).toBe(2);
  });
  test(`${appearance} cancels without saving and handles unsupported files and unit choices`, async ({
    page,
  }, info) => {
    await open(page, appearance);
    const canceledChooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Hevy', exact: true }).click();
    await canceledChooser;
    await page.locator('input[type="file"]').dispatchEvent('cancel');
    await pick(page, 'Name,Value\nUnknown,3');
    await expect(page.getByRole('alert')).toContainText('Unsupported CSV headers');
    await capture(page, info, 'unsupported-file');
    await pick(
      page,
      'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps\n09/10/2026,Strong session,1200,Mystery Lift,1,50,8',
    );
    await expect(page.getByText('Source details needed', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Choose date order', exact: true }),
    ).toBeInViewport({ ratio: 1 });
    await capture(page, info, 'source-details-required');
    await page.getByRole('button', { name: 'Choose date order', exact: true }).click();
    await page.getByRole('radio', { name: 'Day / month / year', exact: true }).click();
    await page.getByRole('button', { name: 'Choose source weight unit', exact: true }).click();
    await page.getByRole('radio', { name: 'Kilograms (kg)', exact: true }).click();
    await expect(page.getByText('1 valid workout', { exact: true })).toBeVisible();
    await capture(page, info, 'source-unit-and-date-resolved');
    await advance(page);
    await asCustom(page);
    await advance(page);
    await page.getByRole('button', { name: 'Back in CSV import', exact: true }).click();
    await advance(page);
    await expect(page.getByRole('checkbox', { name: 'Strong session', exact: true })).toBeChecked();
    await page.getByRole('button', { name: 'Cancel CSV import', exact: true }).click();
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem('@forge/completed-workouts') ?? '[]').length,
      ),
    ).toBe(0);
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem('@forge/custom-exercises') ?? '[]').length,
      ),
    ).toBe(0);
  });
}
test('large CSV history uses a windowed review list', async ({ page }) => {
  await open(page, 'dark');
  await pick(
    page,
    `${header}\n${Array.from({ length: 2000 }, (_, index) => row(`Session ${index}`)).join('\n')}`,
  );
  await expect(page.getByText('2000 valid workouts', { exact: true })).toBeVisible();
  await advance(page);
  await asCustom(page);
  await advance(page);
  await expect(page.getByRole('button', { name: 'Review 2000 workouts' })).toBeEnabled();
  expect(await page.getByRole('checkbox').count()).toBeLessThan(150);
});
