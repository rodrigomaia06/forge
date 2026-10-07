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

}
