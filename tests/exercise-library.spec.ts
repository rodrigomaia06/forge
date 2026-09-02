import { expect, test } from '@playwright/test';

async function openAllExercises(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Exercises' }).click();
  await page.getByRole('button', { name: 'All exercises, 21 exercises' }).click();
}

test.describe('Exercise library', () => {
  test('groups movement variations and applies multi-select facets', async ({ page }) => {
    await openAllExercises(page);
    await expect(page.getByTestId('settings-detail-title').last()).toHaveText('All exercises');
    await expect(page.getByRole('button', { name: 'Bench Press, 4 variations' })).toBeVisible();
    await page.getByRole('button', { name: 'Bench Press, 4 variations' }).click();
    await expect(page.getByText('Close grip', { exact: true })).toBeVisible();

    await page.getByLabel('Search exercises').fill('Pec Deck');
    await expect(page.getByRole('button', { name: 'Open Pec Deck' })).toBeVisible();

    await page.getByRole('button', { name: 'Filters' }).click();
    await expect(page.getByRole('checkbox', { name: 'Machine', exact: true })).toHaveCSS('min-height', '38px');
    await page.getByRole('checkbox', { name: 'Machine', exact: true }).click();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('button', { name: 'Remove Machine filter' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear all filters' }).click();
  });

  test('shows built-in exercise metadata and persists its rest override', async ({ page }) => {
    await openAllExercises(page);
    await page.getByRole('button', { name: 'Bench Press, 4 variations' }).click();
    await page.getByRole('button', { name: 'Standard' }).click();
    await expect(page.getByText('Category', { exact: true })).toBeVisible();
    await expect(page.getByText('Bench Press', { exact: true }).last()).toBeVisible();
    await expect(page.getByText('Primary muscle', { exact: true })).toBeVisible();
    await expect(page.getByText('Chest', { exact: true })).toBeVisible();
    await expect(page.getByTestId('exercise-section-type-strength').locator('svg')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Change rest time, currently Default' })).toBeVisible();
    const detailSheet = page.getByTestId('exercise-detail-sheet-surface');
    await page.waitForTimeout(250);
    const detailBox = await detailSheet.boundingBox();
    await page.getByRole('button', { name: 'Change rest time, currently Default' }).click();
    await expect(page.getByTestId('exercise-rest-selection-view')).toBeVisible();
    await expect(page.getByText('Rest Time', { exact: true })).toBeVisible();
    const restPicker = page.getByTestId('exercise-rest-selection-list');
    await page.waitForTimeout(250);
    const sheetBox = await detailSheet.boundingBox();
    const listBox = await restPicker.boundingBox();
    expect(listBox?.height).toBe(52 * 6);
    expect(sheetBox?.height ?? 0).toBeGreaterThan(detailBox?.height ?? Infinity);
    expect((sheetBox?.y ?? Infinity) + (sheetBox?.height ?? 0)).toBeCloseTo(page.viewportSize()?.height ?? 0, 0);
    await expect(page.getByTestId('exercise-detail-sheet-surface')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Use default rest time' })).toBeVisible();
    await expect(restPicker).toHaveAttribute('role', 'radiogroup');
    await expect(restPicker.locator('svg')).toHaveCount(0);
    await page.getByRole('button', { name: 'Back to exercise details' }).click();
    await expect(page.getByRole('button', { name: 'Change rest time, currently Default' })).toBeVisible();
    const restoredDetailBox = await detailSheet.boundingBox();
    expect(restoredDetailBox?.height ?? Infinity).toBeLessThan(sheetBox?.height ?? 0);
    await page.getByRole('button', { name: 'Change rest time, currently Default' }).click();
    await page.getByRole('radio', { name: 'Rest duration 02:00' }).click();
    await expect(page.getByRole('button', { name: 'Change rest time, currently 2:00' })).toBeVisible();
    await page.getByRole('button', { name: 'Change rest time, currently 2:00' }).click();
    await expect(page.getByRole('radio', { name: 'Rest duration 02:00' })).toHaveAttribute('aria-checked', 'true');
    await restPicker.getByLabel('Selection options').evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      element.dispatchEvent(new Event('scroll', { bubbles: true }));
    });
    await page.getByRole('radio', { name: 'Rest duration 10:00' }).click();
    await expect(page.getByRole('button', { name: 'Change rest time, currently 10:00' })).toBeVisible();
    await page.getByRole('button', { name: 'Change rest time, currently 10:00' }).click();
    await expect(page.getByRole('radio', { name: 'Rest duration 10:00' })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: 'Use default rest time' }).click();
    await expect(page.getByRole('button', { name: 'Change rest time, currently Default' })).toBeVisible();
    await page.getByRole('button', { name: 'Change rest time, currently Default' }).click();
    await page.getByTestId('exercise-detail-sheet-backdrop').click({ position: { x: 4, y: 4 } });
    await expect(page.getByTestId('exercise-rest-selection-view')).toHaveCount(0);
    await expect(page.getByTestId('exercise-detail-sheet-surface')).toHaveCount(0);
  });

  test('adds a variation from a single exercise with its current equipment or a custom one', async ({ page }) => {
    await openAllExercises(page);
    const addVariation = page.getByRole('button', { name: 'Add variation to Pec Deck' });
    await expect(addVariation).toHaveCSS('height', '38px');
    await expect(addVariation).toHaveCSS('border-width', '1px');
    await expect(addVariation).toHaveCSS('border-top-style', 'dashed');
    await page.getByRole('button', { name: 'Add variation to Pec Deck' }).click();

    const formSurface = page.getByTestId('custom-exercise-form-surface');
    const formBox = await formSurface.boundingBox();
    const windowHeight = await page.evaluate(() => window.innerHeight);
    expect(formBox?.height ?? Infinity).toBeLessThanOrEqual(windowHeight * 0.82 + 1);
    await expect(page.getByLabel('Exercise category')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Save variation' })).toBeDisabled();
    const machineEquipment = page.getByRole('radio', { name: 'Equipment Machine' });
    await expect(machineEquipment).toHaveAttribute('aria-checked', 'true');
    await expect(machineEquipment.getByTestId('choice-selection-verified').first()).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Section Strength' }).locator('svg').first()).toBeVisible();
    await page.getByRole('radio', { name: 'Add custom equipment' }).click();
    await expect(
      page.getByRole('radio', { name: 'Add custom equipment' }).getByTestId('choice-selection-note').first(),
    ).toBeVisible();
    await page.getByRole('textbox', { name: 'Custom equipment' }).fill('Cable');
    await page.getByLabel('Exercise name').fill('Cable Pec Deck');
    await expect(page.getByRole('button', { name: 'Save variation' })).toBeEnabled();
    await page.getByRole('button', { name: 'Save variation' }).click();

    const pecDeck = page.getByRole('button', { name: /^Pec Deck, [2-9]\d* variations$/ });
    await expect(pecDeck).toBeVisible();
    await pecDeck.click();
    await expect(page.getByText('Cable Pec Deck', { exact: true })).toHaveCount(1);
  });

  test('creates and persists a custom movement', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Exercises' }).click();
    await page.getByRole('button', { name: 'Custom exercises, 0 exercises' }).click();
    await page.getByRole('button', { name: 'Create custom exercise' }).click();
    await page.getByLabel('Exercise name').fill('Cable Press Around');
    await expect(page.getByRole('radiogroup', { name: 'Exercise equipment' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Equipment Cable' })).toBeVisible();
    await page.getByRole('button', { name: 'Save variation' }).click();
    await expect(
      page.getByRole('button', { name: 'Open Cable Press Around' }),
    ).toBeVisible();
  });

  test('edits custom exercise sections and muscle targets', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Exercises' }).click();
    await page.getByRole('button', { name: 'Custom exercises, 0 exercises' }).click();
    await page.getByRole('button', { name: 'Create custom exercise' }).click();
    await page.getByLabel('Exercise name').fill('Custom Row');
    await page.getByLabel('Exercise category').fill('Bench');
    await page.getByRole('button', { name: 'Use category Bench Press' }).click();
    await expect(page.getByTestId('category-source-forge').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Use category Bench Press' })).toHaveCount(0);
    await page.getByLabel('Exercise category').fill('Rows');
    await expect(page.getByRole('button', { name: 'Add Rows as a custom category' })).toBeVisible();
    await page.getByRole('button', { name: 'Add Rows as a custom category' }).click();
    await expect(page.getByTestId('category-source-custom').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Rows as a custom category' })).toHaveCount(0);
    await page.getByRole('checkbox', { name: 'Section Mobility' }).click();
    await page.getByRole('checkbox', { name: 'Primary Back' }).click();
    await page.getByRole('checkbox', { name: 'Secondary Biceps' }).click();
    await page.getByRole('button', { name: 'Save variation' }).click();
    await page.getByRole('button', { name: 'Open Rows' }).click();
    const details = page.getByRole('dialog');
    await expect(page.getByRole('button', { name: 'Delete variation' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit variation' })).toBeVisible();
    await expect(details).toContainText('Mobility');
    await expect(details).toContainText('Back');
    await expect(details).toContainText('Biceps');
  });
});
