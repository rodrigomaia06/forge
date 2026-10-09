import { expect, test, type Page, type TestInfo } from '@playwright/test';

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
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /Choose (CSV file|another CSV)/ }).click();
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
for (const appearance of ['light', 'dark'] as const) {
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
    await page.getByRole('textbox', { name: 'Search Forge exercises' }).fill('Barbell Bench Press');
    await expect(
      page.getByRole('button', { name: 'Barbell Bench Press', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Barbell Bench Press', exact: true }).press('Enter');
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
    await expect(page.getByText('Remembered match: Mystery Lift', { exact: true })).toBeVisible();
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
    await expect(page.getByText('1 added · 1 replaced', { exact: true })).toBeVisible();
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
    await page.getByRole('button', { name: 'Choose CSV file', exact: true }).click();
    await canceledChooser;
    await page.locator('input[type="file"]').dispatchEvent('cancel');
    await pick(page, 'Name,Value\nUnknown,3');
    await expect(page.getByRole('alert')).toContainText('Unsupported CSV headers');
    await capture(page, info, 'unsupported-file');
    await pick(
      page,
      'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps\n09/10/2026,Strong session,1200,Mystery Lift,1,50,8',
    );
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
