import { expect, test, type Page } from '@playwright/test';
import { defaultSettingsPreferences } from '../../../src/data/settingsDefaults';

async function seed(page: Page, appearance: 'light' | 'dark') {
  await page.addInitScript(
    ({ preferences }) => {
      if (sessionStorage.getItem('metadata-seeded')) return;
      sessionStorage.setItem('metadata-seeded', 'yes');
      const workout = (id: string, name: string, type: string) => ({
        id,
        name,
        type,
        startedAt: Date.now() - 600000,
        completedAt: Date.now(),
        note: '',
        exercises: [],
      });
      const routine = (id: string, name: string, type: string) => ({
        id,
        name,
        type,
        createdAt: 1,
        updatedAt: 1,
        exercises: [],
      });
      localStorage.setItem('@forge/settings-preferences', JSON.stringify(preferences));
      localStorage.setItem(
        '@forge/completed-workouts',
        JSON.stringify([
          workout('first', 'Morning lift', 'Strength'),
          workout('second', 'Evening lift', 'strength'),
          workout('other', 'Morning run', 'Cardio'),
          workout('custom', 'Easy recovery', 'Recovery'),
        ]),
      );
      localStorage.setItem(
        '@forge/plans-v1',
        JSON.stringify({
          plans: [
            {
              id: 'weekly',
              name: 'Weekly plan',
              createdAt: 1,
              updatedAt: 1,
              routines: [routine('push', 'Push', 'Strength'), routine('run', 'Run', 'Cardio')],
            },
          ],
          standaloneRoutines: [
            routine('pull', 'Pull', 'strength'),
            routine('rest', 'Rest day', 'Recovery'),
          ],
        }),
      );
    },
    {
      preferences: {
        ...defaultSettingsPreferences,
        appearance,
        workoutTypes: [
          ...defaultSettingsPreferences.workoutTypes,
          { id: 'recovery-custom', name: 'Recovery', color: '#123456', source: 'custom' },
        ],
      },
    },
  );
  await page.goto('/');
  await openTypes(page);
}
async function openTypes(page: Page) {
  await page.getByRole('tab', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Workout types', exact: true }).click();
}
async function stored(page: Page, id = 'strength') {
  return page.evaluate(
    (id) =>
      JSON.parse(localStorage.getItem('@forge/settings-preferences') ?? '{}').workoutTypes.find(
        (type: { id: string }) => type.id === id,
      ),
    id,
  );
}
async function glyph(page: Page, testID: string) {
  return page
    .getByTestId(testID)
    .locator('path')
    .evaluateAll((paths) => paths.map((path) => path.getAttribute('d')).join('|'));
}

for (const appearance of ['light', 'dark'] as const) {
  test(`${appearance} workout type groups sort names alphabetically`, async ({ page }, info) => {
    await seed(page, appearance);
    await page.evaluate(() => {
      const preferences = JSON.parse(localStorage.getItem('@forge/settings-preferences')!);
      preferences.workoutTypes.push(
        { id: 'zeta', name: 'Zeta', color: '#4D7B67', source: 'custom' },
        { id: 'alpha', name: 'alpha', color: '#7C8CF8', source: 'custom' },
        { id: 'zulu', name: 'Zulu', color: '#F27D7D', source: 'custom', hidden: true },
        { id: 'amber', name: 'Amber', color: '#7C8CF8', source: 'custom', hidden: true },
      );
      localStorage.setItem('@forge/settings-preferences', JSON.stringify(preferences));
    });
    await page.goto('/');
    await openTypes(page);
    const rows = page
      .getByTestId('workout-types-scroll')
      .getByRole('button', { name: / workout type$/ });
    expect(
      await rows.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label'))),
    ).toEqual([
      'Calisthenics workout type',
      'Cardio workout type',
      'Court sport workout type',
      'Field sport workout type',
      'Functional workout type',
      'Martial arts workout type',
      'Mobility workout type',
      'Olympic weightlifting workout type',
      'Plyometrics workout type',
      'Strength workout type',
      'alpha workout type',
      'Recovery workout type',
      'Zeta workout type',
      'Amber workout type',
      'Zulu workout type',
    ]);
    await page.screenshot({ path: info.outputPath('alphabetical-included-types.png') });
    await rows.last().scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath('alphabetical-custom-hidden-types.png') });
    const names = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('@forge/settings-preferences')!).workoutTypes.map(
        (type: { name: string }) => type.name,
      ),
    );
    expect(names.slice(0, 3)).toEqual(['Strength', 'Calisthenics', 'Cardio']);
  });

  test(`${appearance} types show colored icons and expanded training choices persist`, async ({
    page,
  }, info) => {
    await seed(page, appearance);
    await expect(
      page.getByTestId('workout-type-icon-strength').and(page.locator('svg')),
    ).toBeVisible();
    await expect(page.getByTestId('workout-type-icon-strength').and(page.locator('svg'))).toHaveCSS(
      'stroke',
      'rgb(124, 140, 248)',
    );
    await page.screenshot({ path: info.outputPath('type-list-icons.png') });
    await page.getByRole('button', { name: 'Cardio workout type', exact: true }).click();
    await page.getByRole('switch', { name: 'Show Cardio in workout pickers' }).click();
    await page.getByRole('button', { name: 'Back to Workout types' }).click();
    await page.getByRole('button', { name: 'Recovery workout type', exact: true }).click();
    await page.getByRole('button', { name: 'Workout type icon' }).click();
    await expect(page.getByTestId('workout-type-icon-grid')).toBeVisible();
    await expect(page.getByTestId('workout-type-icon-grid').getByRole('radio')).toHaveCount(28);
    await page.waitForTimeout(550);
    await expect(page.getByTestId('workout-type-icon-scroll')).toHaveCSS('overflow-y', 'hidden');
    await page.screenshot({ path: info.outputPath('icon-grid.png') });
    await page.getByRole('radio', { name: 'Swimming', exact: true }).click();
    await expect.poll(() => stored(page, 'recovery-custom')).toMatchObject({ icon: 'swimming' });
    const selectedGlyph = await glyph(page, 'workout-type-preview-icon');
    expect(selectedGlyph).not.toBe('');
    await page.getByRole('button', { name: 'Back to Workout types' }).click();
    await page.getByTestId('workout-types-scroll').evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    await expect(
      page.getByTestId('workout-type-icon-recovery-custom').and(page.locator('svg')),
    ).toBeInViewport();
    expect(await glyph(page, 'workout-type-icon-recovery-custom')).toBe(selectedGlyph);
    await expect(
      page.getByTestId('workout-type-icon-recovery-custom').and(page.locator('svg')),
    ).toHaveCSS('stroke', 'rgb(18, 52, 86)');
    await expect(
      page.getByRole('button', { name: 'Cardio workout type', exact: true }),
    ).toContainText('Hidden');
    await expect(
      page.getByTestId('workout-type-icon-cardio').and(page.locator('svg')),
    ).toBeInViewport();
    await page.screenshot({ path: info.outputPath('custom-hidden-type-icons.png') });
    await page.goto('/');
    await openTypes(page);
    await page.getByRole('button', { name: 'Recovery workout type', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Workout type icon' })).toContainText('Swimming');
    await page.getByRole('button', { name: 'Workout type icon' }).click();
    await expect(page.getByRole('radio', { name: 'Swimming', exact: true })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.waitForTimeout(550);
    await page.screenshot({ path: info.outputPath('selected-icon-grid.png') });
  });

  test(`${appearance} included icon persists and usage links open matching workouts and routines`, async ({
    page,
  }, info) => {
    await seed(page, appearance);
    const originalHistory = await page.evaluate(() =>
      localStorage.getItem('@forge/completed-workouts'),
    );
    await page.getByRole('button', { name: 'Strength workout type', exact: true }).click();
    const originalGlyph = await glyph(page, 'workout-type-preview-icon');
    await expect(
      page.getByRole('button', { name: 'Saved workouts using Strength, 2' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Routines using Strength, 2' })).toBeVisible();
    await page.getByRole('button', { name: 'Workout type icon', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Use default workout type icon' })).toBeVisible();
    await page.waitForTimeout(550);
    await page.screenshot({ path: info.outputPath('icon-choices.png') });
    await page.getByRole('radio', { name: 'Kettlebell', exact: true }).click();
    await expect(page.getByTestId('workout-type-icon-picker')).toHaveCount(0);
    await expect.poll(() => stored(page)).toMatchObject({ icon: 'weight' });
    const chosenGlyph = await glyph(page, 'workout-type-preview-icon');
    expect(chosenGlyph).not.toBe(originalGlyph);
    await page.screenshot({ path: info.outputPath('icon-and-usage-editor.png') });

    await page.getByRole('button', { name: 'Saved workouts using Strength, 2' }).click();
    await expect(page.getByRole('button', { name: 'Open workout Morning lift' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open workout Evening lift' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open workout Morning run' })).toHaveCount(0);
    await page.screenshot({ path: info.outputPath('type-workouts.png') });
    await page.getByRole('button', { name: 'Open workout Morning lift' }).click();
    await page.getByRole('button', { name: 'Back to type workouts' }).click();
    await expect(page.getByTestId('workout-type-usage-list')).toBeVisible();
    await page.getByRole('button', { name: 'Back to workout type' }).click();
    await page.getByRole('button', { name: 'Routines using Strength, 2' }).click();
    await expect(page.getByRole('button', { name: 'Open routine Push' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open routine Pull' })).toBeVisible();
    await expect(page.getByText('Weekly plan · 0 exercises')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open routine Run' })).toHaveCount(0);
    await page.screenshot({ path: info.outputPath('type-routines.png') });
    await page.getByRole('button', { name: 'Open routine Push' }).click();
    await page.getByRole('button', { name: 'Cancel editing routine' }).click();
    await page.getByRole('button', { name: 'Back to workout type' }).click();
    await page.getByRole('button', { name: 'Back to Workout types' }).click();
    await page.getByRole('button', { name: 'Back to Settings' }).click();
    await page.getByRole('tab', { name: 'History' }).click();
    expect(await glyph(page, 'history-type-icon-first')).toBe(chosenGlyph);
    await page.getByRole('tab', { name: 'Plans' }).click();
    expect(
      await page
        .getByRole('button', { name: 'Start Push', exact: true })
        .locator('path')
        .evaluateAll((paths) => paths.map((path) => path.getAttribute('d')).join('|')),
    ).toBe(chosenGlyph);
    expect(await page.evaluate(() => localStorage.getItem('@forge/completed-workouts'))).toBe(
      originalHistory,
    );

    await page.goto('/');
    await openTypes(page);
    await page.getByRole('button', { name: 'Strength workout type', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Workout type icon' })).toContainText(
      'Kettlebell',
    );
    await page.getByRole('button', { name: 'Workout type icon' }).click();
    await page.getByRole('button', { name: 'Use default workout type icon' }).click();
    await expect.poll(async () => (await stored(page)).icon).toBeUndefined();
    expect(await glyph(page, 'workout-type-preview-icon')).toBe(originalGlyph);
  });

  test(`${appearance} custom icons and icon-only drafts keep immediate and draft save behavior`, async ({
    page,
  }, info) => {
    await seed(page, appearance);
    await page.getByRole('button', { name: 'Recovery workout type', exact: true }).click();
    await page.getByRole('button', { name: 'Workout type icon' }).click();
    await page.getByRole('radio', { name: 'Runner', exact: true }).click();
    await expect.poll(() => stored(page, 'recovery-custom')).toMatchObject({ icon: 'activity' });
    await expect(
      page.getByRole('button', { name: 'Saved workouts using Recovery, 1' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Routines using Recovery, 1' })).toBeVisible();
    await page.screenshot({ path: info.outputPath('custom-icon-editor.png') });
    await page.getByRole('button', { name: 'Back to Workout types' }).click();
    await page.getByRole('button', { name: 'Add workout type' }).click();
    await expect(page.getByText('Used in', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Workout type icon' }).click();
    await page.getByRole('radio', { name: 'Kettlebell', exact: true }).click();
    await page.getByRole('button', { name: 'Cancel new workout type' }).click();
    await expect(page.getByTestId('discard-workout-type-confirmation')).toBeVisible();
    await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Workout type icon' })).toContainText(
      'Kettlebell',
    );
    await page.getByRole('button', { name: 'Cancel new workout type' }).click();
    await page.getByRole('button', { name: 'Discard type', exact: true }).click();
    await expect(page.getByRole('button', { name: 'New type workout type' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Add workout type' }).click();
    await page.getByLabel('Workout type name').fill('Intervals');
    await page.getByRole('button', { name: 'Workout type icon' }).click();
    await page.getByRole('radio', { name: 'Runner', exact: true }).click();
    await page.getByRole('button', { name: 'Save workout type' }).click();
    await page.getByRole('button', { name: 'Intervals workout type' }).click();
    await expect(page.getByRole('button', { name: 'Workout type icon' })).toContainText('Runner');
    await expect(
      page.getByRole('button', { name: 'Saved workouts using Intervals, 0' }),
    ).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Routines using Intervals, 0' })).toBeDisabled();
    await page.screenshot({ path: info.outputPath('unused-type-editor.png') });
    await page.goto('/');
    await openTypes(page);
    await page.getByRole('button', { name: 'Intervals workout type' }).click();
    await expect(page.getByRole('button', { name: 'Workout type icon' })).toContainText('Runner');
  });
}
