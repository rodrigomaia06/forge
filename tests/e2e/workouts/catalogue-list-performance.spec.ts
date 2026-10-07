import { expect, test, type Locator } from '@playwright/test';

async function scrollToFraction(list: Locator, fraction: number) {
  await list.evaluate((element, value) => {
    element.scrollTop = (element.scrollHeight - element.clientHeight) * value;
  }, fraction);
}

for (const appearance of ['light', 'dark'] as const) {
  test(`virtualizes catalogue movements and preserves family selection (${appearance})`, async ({
    page,
  }, testInfo) => {
    await page.addInitScript(
      (theme) =>
        localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance: theme })),
      appearance,
    );
    await page.goto('/');
    await page.getByRole('button', { name: 'Start workout' }).click();
    await page
      .getByTestId('dashboard-workout-source-chooser')
      .getByRole('button', { name: 'Blank workout' })
      .click();
    await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
    const catalogue = page.getByTestId('add-exercise-catalogue');
    await expect(catalogue).toBeVisible();
    await expect.poll(() => catalogue.getByRole('button').count()).toBeGreaterThan(2);
    await expect.poll(() => catalogue.getByRole('button').count()).toBeLessThan(100);
    await page.waitForTimeout(650);
    await page.screenshot({ path: testInfo.outputPath(`catalogue-list-${appearance}.png`) });
    await page.getByLabel('Search exercises').fill('pull up');
    await page
      .getByRole('button', { name: /Pull-Up & \d+ variations/ })
      .first()
      .click();
    const assisted = page.getByRole('checkbox', { name: 'Pull-Up, Assisted', exact: true });
    await assisted.click();
    await expect(assisted).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('exercise-group-count-Pull-Up')).toHaveText('1');
    await page.waitForTimeout(250);
    await page.screenshot({ path: testInfo.outputPath(`catalogue-selection-${appearance}.png`) });
    await page.getByRole('button', { name: 'Clear exercise search' }).click();
    await expect(page.getByLabel('Search exercises')).toHaveValue('');
    await page.getByLabel('Search exercises').fill('pull up');
    await expect(
      page.getByRole('checkbox', { name: 'Pull-Up, Assisted', exact: true }),
    ).toHaveAttribute('aria-checked', 'true');
  });
}

test('keeps equipment choices collapsed for imported families without composable modifiers', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      '@forge/custom-exercises',
      JSON.stringify(
        ['Barbell', 'Dumbbell'].map((equipment) => ({
          id: `custom-legacy-${equipment}`,
          name: `Legacy press ${equipment}`,
          group: 'Legacy press',
          equipment,
          primaryEquipment: equipment,
          category: 'Chest',
          primaryMuscle: 'Chest',
          secondaryMuscles: [],
          aliases: [],
          workoutTypeIds: ['strength'],
          trackingType: 'weight-reps',
        })),
      ),
    );
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await page
    .getByTestId('dashboard-workout-source-chooser')
    .getByRole('button', { name: 'Blank workout' })
    .click();
  await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
  await page.getByLabel('Search exercises').fill('Legacy press');
  const family = page.getByRole('button', { name: 'Legacy press & 2 variations' });
  const equipment = page.getByRole('checkbox', { name: 'Legacy press, Barbell', exact: true });
  await expect(family).toBeVisible();
  await expect(equipment).toHaveCount(0);
  await family.click();
  await expect(equipment).toBeVisible();
  await equipment.click();
  await expect(equipment).toHaveAttribute('aria-checked', 'true');
  await family.click();
  await expect(equipment).toHaveCount(0);
  await family.click();
  await expect(equipment).toHaveAttribute('aria-checked', 'true');
});
