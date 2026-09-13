import { expect, test } from '@playwright/test';

async function swipeLeftFrom(
  page: import('@playwright/test').Page,
  locator: import('@playwright/test').Locator,
) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Expected swipe target to be measurable');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 100, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
}

async function openAllExercises(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Exercises' }).click();
  await page.getByRole('button', { name: 'All exercises, 381 exercises' }).click();
}

// Playwright's iPhone viewport reports zero CSS safe-area insets. Drive the
// library's real web measurement element so these checks exercise nonzero
// inset propagation without adding a testing override to the application.
async function setSafeArea(page: import('@playwright/test').Page, top: number, bottom: number) {
  await page.locator('body > div').filter({ visible: false }).evaluateAll((elements, insets) => {
    const probe = elements.find((element) =>
      (element as HTMLElement).style.paddingTop.includes('safe-area-inset-top'),
    ) as HTMLElement | undefined;
    if (!probe) throw new Error('Expected the safe-area measurement element');
    probe.style.paddingTop = `${insets.top}px`;
    probe.style.paddingBottom = `${insets.bottom}px`;
    probe.dispatchEvent(new Event('transitionend'));
  }, { top, bottom });
}

async function waitForFilterSheet(page: import('@playwright/test').Page) {
  await expect(page.getByTestId('exercise-filter-sheet-surface')).toHaveCSS(
    'transform', 'matrix(1, 0, 0, 1, 0, 0)',
  );
}

async function scrollToEnd(locator: import('@playwright/test').Locator) {
  return locator.evaluate((element) => {
    const candidates = [
      element as HTMLElement,
      ...Array.from(element.querySelectorAll<HTMLElement>('*')),
    ];
    const scroller = candidates.find((node) => {
      const style = window.getComputedStyle(node);
      return node.scrollHeight > node.clientHeight + 1 && /auto|scroll/.test(style.overflowY);
    });
    if (!scroller) throw new Error('Expected the exercise browser to have a bounded vertical scroller');
    scroller.scrollTop = scroller.scrollHeight;
    scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
    const bounds = scroller.getBoundingClientRect();
    return {
      scrollTop: scroller.scrollTop,
      maximumOffset: scroller.scrollHeight - scroller.clientHeight,
      viewportBottom: bounds.bottom,
    };
  });
}

test.describe('Exercise library', () => {
  test('keeps the compact filter summary usable in a shorter iPhone viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 320 });
    await openAllExercises(page);
    await page.getByRole('button', { name: 'Filters' }).click();
    await waitForFilterSheet(page);

    const summary = page.getByTestId('catalog-filter-summary-scroll');
    const metrics = await scrollToEnd(summary);
    expect(metrics.scrollTop).toBeGreaterThanOrEqual(metrics.maximumOffset - 1);
    const category = page.getByRole('button', { name: 'Edit Category filter, Any' });
    await expect(category).toBeVisible();
    const categoryBox = await category.boundingBox();
    expect((categoryBox?.y ?? Infinity) + (categoryBox?.height ?? Infinity)).toBeLessThanOrEqual(
      metrics.viewportBottom + 1,
    );
    const applyBox = await page.getByRole('button', { name: 'Apply filters' }).boundingBox();
    expect((categoryBox?.y ?? Infinity) + (categoryBox?.height ?? Infinity)).toBeLessThanOrEqual(
      applyBox?.y ?? -Infinity,
    );
    await category.click();
    await page.getByRole('checkbox').first().click();
    await page.getByRole('button', { name: 'Back to filters' }).click();
    await page.getByRole('button', { name: 'Apply (1)' }).click();
    await expect(page.getByRole('button', { name: 'Filters, 1 active' })).toBeVisible();
  });

  test('sizes the two-facet filter summary to its cards without a top gap', async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance: 'dark' }));
    });
    await page.goto('/');
    await expect(page.getByTestId('dashboard-shell')).toBeVisible();
    await setSafeArea(page, 62, 34);
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Exercises', exact: true }).click();
    await page.getByRole('button', { name: 'Strength, 255 exercises' }).click();
    await page.getByRole('button', { name: 'Filters' }).click();
    await waitForFilterSheet(page);
    const sheet = page.getByTestId('catalog-filter-content');
    const first = sheet.getByRole('button', { name: 'Edit Equipment filter, Any' });
    const header = sheet.getByTestId('forge-sheet-drag-area');
    await expect(first).toBeVisible();
    await expect.poll(async () => {
      const firstBox = await first.boundingBox();
      const headerBox = await header.boundingBox();
      return Math.round((firstBox?.y ?? Infinity) - ((headerBox?.y ?? 0) + (headerBox?.height ?? 0)));
    }).toBe(9); // 8 pt content padding + 1 pt card border
    expect((await sheet.boundingBox())?.height ?? Infinity).toBeLessThan(340);
    await first.click();
    await page.getByRole('checkbox', { name: 'Filter Equipment: Bench', exact: true }).click();
    await page.getByRole('button', { name: 'Apply (1)', exact: true }).click();
    await page.getByRole('button', { name: 'Filters, 1 active' }).click();
    await waitForFilterSheet(page);
    await expect(sheet.getByRole('button', { name: 'Edit Equipment filter, Bench' })).toBeVisible();
    await expect.poll(async () => Math.round((await sheet.boundingBox())?.height ?? Infinity)).toBeLessThan(340);
    if (testInfo.project.name === 'iphone-air') {
      await page.screenshot({ path: 'tests/results/captures/exercise-filters-compact-safe-area.png' });
    }
  });

  test('groups movement variations and stages multi-select facets before applying them', async ({ page }) => {
    await openAllExercises(page);
    await expect(page.getByTestId('settings-detail-title').last()).toHaveText('All exercises');
    await expect(page.getByRole('button', { name: 'Bench Press & 3 variations' })).toBeVisible();
    await page.getByRole('button', { name: 'Bench Press & 3 variations' }).click();
    await expect(page.getByRole('button', { name: 'Open Flat' }).first()).toBeVisible();

    await page.getByLabel('Search exercises').fill('Pec Deck');
    await expect(page.getByRole('button', { name: 'Open Chest Fly' })).toBeVisible();

    await page.getByRole('button', { name: 'Filters' }).click();
    await expect(page.getByRole('button', { name: 'Show all exercises' })).toHaveCount(0);
    const filterSurface = page.getByTestId('catalog-filter-content');
    const compactFilterBox = await filterSurface.boundingBox();
    expect(compactFilterBox?.height ?? Infinity).toBeLessThan(450);
    await page.getByRole('button', { name: 'Edit Equipment filter, Any' }).click();
    const machine = page.getByRole('checkbox', { name: 'Filter Equipment: Machine' });
    await expect(machine).toHaveCSS('min-height', '56px');
    await machine.click();
    await page.getByRole('button', { name: 'Cancel exercise filters' }).click();
    await expect(page.getByTestId('exercise-filter-sheet')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Remove Machine filter' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Filters' }).click();
    await page.getByRole('button', { name: 'Edit Equipment filter, Any' }).click();
    await page.getByRole('checkbox', { name: 'Filter Equipment: Machine' }).click();
    await page.getByRole('button', { name: 'Back to filters' }).click();
    const clearFilters = page.getByRole('button', { name: 'Clear filters' });
    await expect(clearFilters).toBeVisible();
    await expect(clearFilters).toHaveCSS('border-width', '2px');
    await clearFilters.click();
    await expect(page.getByRole('button', { name: 'Clear filters' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Edit Equipment filter, Any' }).click();
    await page.getByRole('checkbox', { name: 'Filter Equipment: Machine' }).click();
    await page.getByRole('button', { name: 'Back to filters' }).click();
    await page.getByRole('button', { name: 'Edit Category filter, Any' }).click();
    await page.getByRole('checkbox', { name: 'Filter Category: Chest' }).click();
    await page.getByRole('button', { name: 'Apply (2)' }).click();
    await expect(page.getByRole('button', { name: 'Filters, 2 active' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove Machine filter' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Clear all filters' })).toHaveCount(0);
  });

  test('searches selector and filter choices without implicitly selecting a matching name', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Exercises' }).click();
    await page.getByRole('button', { name: 'Custom exercises, 0 exercises' }).click();
    await page.getByRole('button', { name: 'Create custom exercise' }).click();

    await page.getByRole('button', { name: 'Exercise category' }).click();
    const fullBody = page.getByRole('radio', { name: 'Category Full Body' });
    await expect(fullBody).toHaveAttribute('aria-checked', 'true');
    await page.getByLabel('Search categories').fill('Chest');
    await expect(page.getByRole('radio', { name: 'Category Chest' })).toBeVisible();
    await expect(fullBody).toHaveCount(0);
    await page.getByLabel('Search categories').fill('Full Body');
    await expect(fullBody).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: 'Back to exercise form' }).click();

    await page.getByRole('button', { name: 'Equipment' }).click();
    const bodyweight = page.getByRole('radio', { name: 'Equipment Bodyweight' });
    await expect(bodyweight).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('textbox', { name: 'Custom equipment' })).toHaveCount(0);
    await page.getByLabel('Search equipment').fill('Barbell');
    const barbell = page.getByRole('radio', { name: 'Equipment Barbell' });
    await expect(barbell).toHaveAttribute('aria-checked', 'false');
    await page.getByLabel('Search equipment').fill('');
    await expect(bodyweight).toHaveAttribute('aria-checked', 'true');

    await page.getByRole('button', { name: 'Back to exercise form' }).click();
    await page.getByRole('button', { name: 'Close custom exercise form' }).last().click();
    await page.getByRole('button', { name: 'Back to Exercises' }).click();
    await page.getByRole('button', { name: 'All exercises, 381 exercises' }).click();
    await page.getByRole('button', { name: 'Filters' }).click();
    const apply = page.getByRole('button', { name: 'Apply filters' });
    await expect(apply).toBeDisabled();
    const filterSurface = page.getByTestId('catalog-filter-content');
    expect((await filterSurface.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(300);
    await page.getByRole('button', { name: 'Edit Equipment filter, Any' }).click();
    await page.getByLabel('Search equipment filters').fill('Machine');
    const machine = page.getByRole('checkbox', { name: 'Filter Equipment: Machine' });
    await expect(machine).toBeVisible();
    await expect(page.getByRole('button', { name: 'Apply filters' })).toBeDisabled();
    await machine.click();
    await expect(page.getByRole('button', { name: 'Apply (1)' })).toBeEnabled();
    await page.getByRole('button', { name: 'Back to filters' }).click();
    await expect(page.getByRole('button', { name: 'Clear filters' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page.getByRole('button', { name: 'Apply filters' })).toBeDisabled();
  });

  test('shows built-in exercise metadata and persists its rest override', async ({ page }) => {
    await openAllExercises(page);
    await page.getByRole('button', { name: 'Bench Press & 3 variations' }).click();
    await page.getByRole('button', { name: 'Open Flat' }).first().click();
    await expect(page.getByText('Category', { exact: true })).toBeVisible();
    await expect(page.getByText('Bench Press', { exact: true }).last()).toBeVisible();
    await expect(page.getByText('Primary muscle', { exact: true })).toBeVisible();
    await expect(page.getByText('Chest', { exact: true }).first()).toBeVisible();
    await expect(page.getByTestId('exercise-section-type-strength').locator('svg')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Change rest time, currently Default' })).toBeVisible();
    const detailSheet = page.getByTestId('exercise-detail-sheet-surface');
    await page.waitForTimeout(250);
    await page.getByRole('button', { name: 'Change rest time, currently Default' }).click();
    await expect(page.getByTestId('exercise-rest-selection-view')).toBeVisible();
    await expect(page.getByText('Rest Time', { exact: true })).toBeVisible();
    const restPicker = page.getByTestId('exercise-rest-selection-list');
    await page.waitForTimeout(250);
    const sheetBox = await detailSheet.boundingBox();
    const listBox = await restPicker.boundingBox();
    expect(listBox?.height).toBe(52 * 6);
    // The picker is intentionally compact; it only needs room for its six-row window.
    expect(sheetBox?.height ?? 0).toBeGreaterThanOrEqual((listBox?.height ?? Infinity) + 88);
    expect((sheetBox?.y ?? Infinity) + (sheetBox?.height ?? 0)).toBeCloseTo(page.viewportSize()?.height ?? 0, 0);
    await expect(page.getByTestId('exercise-detail-sheet-surface')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Use default rest time' })).toBeVisible();
    await expect(restPicker).toHaveAttribute('role', 'radiogroup');
    await expect(restPicker.locator('svg')).toHaveCount(0);
    await page.getByRole('button', { name: 'Back to exercise details' }).click();
    await expect(page.getByRole('button', { name: 'Change rest time, currently Default' })).toBeVisible();
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
    const search = page.getByLabel('Search exercises');
    await search.click();
    await search.pressSequentially('Pec Deck');
    await expect(page.getByRole('button', { name: 'Open Chest Fly' })).toBeVisible();
    const addVariation = page.getByRole('button', { name: 'Add variation to Chest Fly' });
    await expect(addVariation).toHaveCSS('height', '38px');
    await expect(addVariation).toHaveCSS('border-width', '1px');
    await expect(addVariation).toHaveCSS('border-top-style', 'dashed');
    await addVariation.click();

    const formSurface = page.getByTestId('custom-exercise-form-surface');
    const formBox = await formSurface.boundingBox();
    const windowHeight = await page.evaluate(() => window.innerHeight);
    expect(formBox?.height ?? Infinity).toBeLessThanOrEqual(windowHeight * 0.82 + 1);
    await expect(page.getByRole('button', { name: 'Exercise category' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Optional details' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save variation' })).toBeDisabled();
    await page.getByRole('button', { name: 'Equipment' }).click();
    const compactSelectorBox = await formSurface.boundingBox();
    expect(compactSelectorBox?.height ?? Infinity).toBeLessThan(formBox?.height ?? -Infinity);
    await expect(page.getByRole('radio').first()).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('radio', { name: 'Add custom equipment' }).click();
    await expect(page.getByText('Custom equipment', { exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: 'Custom equipment' }).fill('Cable');
    await page.getByRole('button', { name: 'Back to exercise form' }).click();
    await page.getByLabel('Exercise name').fill('Cable Pec Deck');
    await expect(page.getByRole('button', { name: 'Save variation' })).toBeEnabled();
    await page.getByRole('button', { name: 'Save variation' }).click();

    const chestFly = page.getByRole('button', { name: /^Chest Fly & [2-9]\d* variations$/ });
    await expect(chestFly).toBeVisible();
    await chestFly.click();
    await expect(page.getByText('Cable Pec Deck', { exact: true })).toHaveCount(1);
  });

  test('creates and persists a custom movement', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Exercises' }).click();
    await page.getByRole('button', { name: 'Custom exercises, 0 exercises' }).click();
    await page.getByRole('button', { name: 'Create custom exercise' }).click();
    await page.getByLabel('Exercise name').fill('Cable Press Around');
    await page.getByRole('button', { name: 'Equipment' }).click();
    await expect(page.getByRole('radio', { name: 'Equipment Cable' })).toBeVisible();
    await page.getByRole('radio', { name: 'Equipment Cable' }).click();
    await page.getByRole('button', { name: 'Save variation' }).click();
    await expect(
      page.getByRole('button', { name: 'Open Cable Press Around' }),
    ).toBeVisible();
  });

  test('reveals and executes delete when swiping a custom exercise', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Exercises' }).click();
    await page.getByRole('button', { name: 'Custom exercises, 0 exercises' }).click();
    await page.getByRole('button', { name: 'Create custom exercise' }).click();
    await page.getByLabel('Exercise name').fill('Swipe Delete Exercise');
    await page.getByRole('button', { name: 'Save variation' }).click();
    await expect(page.getByTestId('custom-exercise-form-surface')).toHaveCount(0);

    const customExercise = page.getByRole('button', { name: 'Open Swipe Delete Exercise' });
    await expect(customExercise).toBeVisible();
    await swipeLeftFrom(page, customExercise);
    await expect(page.getByRole('button', { name: 'Delete Swipe Delete Exercise' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete Swipe Delete Exercise' }).click();
    await expect(customExercise).toHaveCount(0);
  });

  test('edits custom exercise sections and muscle targets', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Exercises' }).click();
    await page.getByRole('button', { name: 'Custom exercises, 0 exercises' }).click();
    await page.getByRole('button', { name: 'Create custom exercise' }).click();
    await page.getByLabel('Exercise name').fill('Custom Row');
    await page.getByRole('button', { name: 'Optional details' }).click();
    await page.getByRole('button', { name: 'Exercise group' }).click();
    await page.getByLabel('Search exercise groups').fill('Bench');
    await page.getByRole('radio', { name: 'Use exercise group Bench Press' }).click();
    await expect(page.getByRole('radio', { name: 'Use exercise group Bench Press' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Exercise group' }).click();
    await page.getByLabel('Search exercise groups').fill('Rows');
    await expect(page.getByRole('radio', { name: 'Add Rows as a custom exercise group' })).toBeVisible();
    await page.getByRole('radio', { name: 'Add Rows as a custom exercise group' }).click();
    await expect(page.getByRole('radio', { name: 'Add Rows as a custom exercise group' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Workout types' }).click();
    await page.getByRole('checkbox', { name: 'Workout type Mobility' }).click();
    await page.getByRole('button', { name: 'Back to exercise form' }).click();
    await page.getByRole('button', { name: 'Primary muscle' }).click();
    await page.getByRole('radio', { name: 'Primary Lats' }).click();
    await page.getByRole('button', { name: 'Secondary muscles' }).click();
    await page.getByRole('checkbox', { name: 'Secondary Biceps' }).click();
    await page.getByRole('button', { name: 'Back to exercise form' }).click();
    await page.getByRole('button', { name: 'Save variation' }).click();
    await page.getByRole('button', { name: 'Open Rows' }).click();
    const details = page.getByRole('dialog');
    await expect(page.getByRole('button', { name: 'Delete variation' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit variation' })).toBeVisible();
    await expect(details).toContainText('Mobility');
    await expect(details).toContainText('Lats');
    await expect(details).toContainText('Biceps');
  });
});
