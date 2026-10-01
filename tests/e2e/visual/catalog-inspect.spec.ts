import { expect, test } from '@playwright/test';

test('presents imported triceps movements through the Forge hierarchy', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await page.getByTestId('dashboard-workout-source-chooser').getByRole('button', { name: 'Blank workout' }).click();
  await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
  await expect(page.getByTestId('add-exercise-catalogue')).toBeVisible();
  await page.waitForTimeout(260);
  const search = page.getByLabel('Search exercises');
  await search.fill('triceps extension');
  await expect(search).toHaveValue('triceps extension');
  await page.waitForTimeout(180);
  const family = page.getByRole('button', { name: /Triceps Extension & \d+ variations/ });
  await expect(family).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('curated-triceps-picker-iphone.png') });
  await family.click();
  await expect(page.getByRole('checkbox', { name: 'Triceps Extension, Kneeling' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('curated-triceps-equipment-iphone.png') });
});

test('keeps Strength families concise and names leg movements correctly', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await page
    .getByTestId('dashboard-workout-source-chooser')
    .getByRole('button', { name: 'Blank workout' })
    .click();
  await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
  await expect(page.getByTestId('add-exercise-catalogue')).toBeVisible();
  await page.getByLabel('Search exercises').fill('lateral raise');
  await expect(page.getByRole('button', { name: /Lateral Raise & 4 variations/ })).toBeVisible();
  await expect(page.getByText('Side Lateral Raise', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Crunch Legs Exercise', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('add-exercise-catalogue')).toBeVisible();
  await page.waitForTimeout(180);
  if (testInfo.project.use.isMobile === true) {
    await page.screenshot({ path: testInfo.outputPath('concise-strength-lateral-raise-iphone.png') });
  }

  await page.getByLabel('Search exercises').fill('leg curl');
  await expect(page.getByRole('button', { name: /Leg Curl & \d+ variations/ })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Leg', exact: true })).toHaveCount(0);
  if (testInfo.project.use.isMobile === true) {
    // The picker is a bounded sheet; its viewport is the exact visual state
    // under review and avoids asking WebKit to rasterize virtualized content
    // beyond the visible sheet.
    await page.screenshot({ path: testInfo.outputPath('concise-strength-leg-curl-iphone.png') });
  }
});

test('presents no-equipment trunk rotation as Bodyweight', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await page
    .getByTestId('dashboard-workout-source-chooser')
    .getByRole('button', { name: 'Blank workout' })
    .click();
  await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
  await page.getByLabel('Search exercises').fill('trunk rotation');
  const family = page.getByRole('button', { name: /Trunk Rotation & 5 variations/ });
  await expect(family).toBeVisible();
  await family.click();
  await expect(page.getByText('Bodyweight', { exact: true })).toBeVisible();
  await expect(page.getByText('None', { exact: true })).toHaveCount(0);
  if (testInfo.project.use.isMobile === true) {
    await page.screenshot({ path: testInfo.outputPath('trunk-rotation-bodyweight-iphone.png') });
  }
});

test('finds and selects a curated compound variation from the default workout-type scope', async ({ page }, testInfo) => {
  test.setTimeout(15_000);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await page.getByTestId('dashboard-workout-source-chooser').getByRole('button', { name: 'Blank workout' }).click();
  await page.getByRole('button', { name: 'Add exercise', exact: true }).click();

  const catalogue = page.getByTestId('add-exercise-catalogue');
  await expect(catalogue).toBeVisible();
  await page.waitForTimeout(260);
  // A new Strength session starts scoped to Strength, but Filters provides an
  // explicit Clear action for people who want the complete catalogue.
  await expect(page.getByRole('button', { name: /Filters, 1 active/ })).toBeVisible();
  await page.getByRole('button', { name: /Filters, 1 active/ }).click();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page.getByRole('button', { name: 'Filters', exact: true })).toBeVisible();
  const search = page.getByLabel('Search exercises');
  await search.fill('weighted wide pronated pullups');
  await expect(search).toHaveValue('weighted wide pronated pullups');
  const variation = catalogue.getByRole('checkbox', { name: 'Pull-Up, variation' });
  await expect(variation).toBeVisible();
  await expect(variation).toContainText('Weighted · Wide · Pronated');
  await variation.click();
  await page.screenshot({ path: testInfo.outputPath('compound-after-tap-iphone.png'), fullPage: true });
  await expect(page.getByText('Add exercises (1)', { exact: true })).toBeVisible();
  if (testInfo.project.use.isMobile === true) {
    await page.screenshot({ path: testInfo.outputPath('curated-compound-pull-up-iphone.png'), fullPage: true });
  }
  await page.getByRole('button', { name: 'Confirm selected exercises' }).click();
  await expect(page.getByText('Weighted Wide Pronated Pull-Up', { exact: true })).toBeVisible();
});

test('combines compatible modifiers directly and resolves conflicting choices', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await page.getByTestId('dashboard-workout-source-chooser').getByRole('button', { name: 'Blank workout' }).click();
  await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
  await page.waitForTimeout(260);
  await page.getByLabel('Search exercises').fill('pull up');
  const pullUps = page.getByRole('button', { name: /Pull-Up & \d+ variations/ }).first();
  await expect(pullUps).toBeVisible();
  await pullUps.click();
  await page.getByRole('checkbox', { name: 'Pull-Up, Weighted' }).click();
  await page.getByRole('checkbox', { name: 'Pull-Up, Pronated' }).click();
  if (testInfo.project.use.isMobile === true) {
    await page.screenshot({ path: testInfo.outputPath('facet-pull-up-variation-iphone.png'), fullPage: true });
  }
  await page.getByRole('button', { name: 'Confirm selected exercises' }).click();
  await expect(page.getByText('Weighted Pull-Up', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Add exercise' }).click();
  await page.getByLabel('Search exercises').fill('pull up');
  await page.getByRole('button', { name: /Pull-Up & \d+ variations/ }).first().click();
  await page.getByRole('checkbox', { name: 'Pull-Up, Weighted' }).click();
  await page.getByRole('checkbox', { name: 'Pull-Up, Supinated' }).click();
  await page.getByRole('checkbox', { name: 'Pull-Up, Pronated' }).click();
  await page.getByRole('button', { name: 'Confirm selected exercises' }).click();
  await expect(page.getByTestId('variation-output-chooser')).toBeVisible();
  // A resolved title is canonical and self-describing; derived does not mean
  // it needs a generic secondary label in the chooser.
  await expect(page.getByText('New variation', { exact: true })).toHaveCount(0);
  if (testInfo.project.use.isMobile === true) {
    await page.screenshot({ path: testInfo.outputPath('ambiguous-pull-up-output-iphone.png'), fullPage: true });
  }
  await page.getByRole('checkbox', { name: 'Weighted Chin-Up' }).click();
  await page.getByRole('checkbox', { name: 'Pull-Up', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm resolved exercises' }).click();
  await expect(page.getByText('Weighted Chin-Up', { exact: true })).toBeVisible();
});

test('reveals assistance methods only after selecting the assisted load mode', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await page.getByTestId('dashboard-workout-source-chooser').getByRole('button', { name: 'Blank workout' }).click();
  await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
  await page.getByLabel('Search exercises').fill('pull up');
  await page.getByRole('button', { name: /Pull-Up & \d+ variations/ }).first().click();
  await expect(page.getByRole('checkbox', { name: 'Pull-Up, Band' })).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Pull-Up, Assisted' }).click();
  await expect(page.getByRole('checkbox', { name: 'Pull-Up, Band' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Pull-Up, Machine' })).toBeVisible();
});

test('asks before joining wide and neutral as one movement', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await page.getByTestId('dashboard-workout-source-chooser').getByRole('button', { name: 'Blank workout' }).click();
  await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
  await page.getByLabel('Search exercises').fill('pull up');
  await page.getByRole('button', { name: /Pull-Up & \d+ variations/ }).first().click();
  await page.getByRole('checkbox', { name: 'Pull-Up, Wide' }).click();
  await page.getByRole('checkbox', { name: 'Pull-Up, Neutral' }).click();
  await page.getByRole('button', { name: 'Confirm selected exercises' }).click();
  await expect(page.getByTestId('variation-output-chooser')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Wide-Grip Pull-Up' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Neutral-Grip Pull-Up' })).toBeVisible();
});
