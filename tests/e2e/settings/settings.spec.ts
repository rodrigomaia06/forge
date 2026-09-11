import { expect, test } from '@playwright/test';

test.describe('Settings', () => {
  async function expectRowHeight(
    locator: import('@playwright/test').Locator,
    expectedHeight: number,
  ): Promise<void> {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.height).toBeCloseTo(expectedHeight, 0);
  }

  async function expectFontSize(
    locator: import('@playwright/test').Locator,
    expectedSize: number,
  ): Promise<void> {
    await expect(locator).toBeVisible();
    expect(await locator.evaluate((element) => window.getComputedStyle(element).fontSize)).toBe(
      `${expectedSize}px`,
    );
  }

  async function openWorkoutTypes(page: import('@playwright/test').Page): Promise<void> {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Workout types' }).click();
  }

  test('shows grouped settings and opens each destination', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();

    await expect(page.getByTestId('settings-title')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Exercises' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Workout types' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'General' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Backup & Export' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Logs' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'About' })).toBeVisible();

    await page.getByRole('button', { name: 'Exercises' }).click();
    await expect(page.getByTestId('settings-detail-title')).toHaveText('Exercises');
    await expect(page.getByRole('button', { name: 'All exercises, 21 exercises' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Strength, 21 exercises' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mobility, 0 exercises' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cardio, 0 exercises' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Court sport, 0 exercises' })).toBeVisible();
    await page.getByRole('button', { name: 'Strength, 21 exercises' }).click();
    await expect(page.getByTestId('settings-detail-title').last()).toHaveText('Strength');
    await page.getByRole('button', { name: 'Back to Exercises' }).click();
    await page.getByRole('button', { name: 'Back to Settings' }).click();
    await expect(page.getByTestId('settings-title')).toBeVisible();

    await page.getByRole('button', { name: 'Workout types' }).click();
    await expect(page.getByTestId('settings-detail-title')).toHaveText('Workout types');
    await page.getByRole('button', { name: 'Strength workout type' }).click();
    await expect(
      page.getByRole('switch', { name: 'Hide Strength in workout pickers' }),
    ).toBeVisible();
    await expect(page.getByTestId('workout-type-visibility-bottom-divider')).toBeVisible();
    await page.getByRole('button', { name: 'Back to Settings' }).click();

    await page.getByRole('button', { name: 'Backup & Export' }).click();
    await expect(page.getByTestId('settings-detail-title')).toHaveText('Backup & Export');
    await page.getByRole('button', { name: 'Back to Settings' }).click();

    await page.getByRole('button', { name: 'Logs' }).click();
    await expect(page.getByTestId('settings-detail-title')).toHaveText('Logs');
    await page.getByRole('button', { name: 'Back to Settings' }).click();

    await page.getByRole('button', { name: 'About' }).click();
    await expect(page.getByTestId('settings-detail-title')).toHaveText('About');
  });

  test('uses the shared Settings row scale across root and nested cards', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();

    const rootRow = page.getByTestId('settings-main-exercises-row');
    await expectRowHeight(rootRow, 56);
    await expectFontSize(page.getByTestId('settings-main-exercises-row-title'), 16);
    const rootCard = await rootRow.evaluate((element) => {
      const parent = element.parentElement;
      const box = parent?.getBoundingClientRect();
      return {
        x: box?.x,
        width: box?.width,
        radius: parent ? window.getComputedStyle(parent).borderRadius : null,
      };
    });
    expect(rootCard.x).toBeCloseTo(20, 0);
    expect(rootCard.width).toBeCloseTo((page.viewportSize()?.width ?? 40) - 40, 0);
    expect(rootCard.radius).toBe('24px');

    await rootRow.click();
    const libraryRow = page.getByTestId('exercise-library-type-strength');
    await expectRowHeight(libraryRow, 68);
    await expectFontSize(page.getByTestId('exercise-library-type-strength-title'), 16);
    await page.getByRole('button', { name: 'All exercises, 21 exercises' }).click();
    const movementRow = page.getByRole('button', { name: 'Bench Press, 4 variations' });
    await expectRowHeight(movementRow, 68);
    await expectFontSize(page.getByText('Bench Press', { exact: true }), 16);

    await page.getByRole('button', { name: 'Back to Exercises' }).click();
    await page.getByRole('button', { name: 'Back to Settings' }).click();
    await page.getByRole('button', { name: 'Workout types' }).click();
    await expectRowHeight(page.getByRole('button', { name: 'Strength workout type' }), 56);

    await page.getByRole('button', { name: 'Back to Settings' }).click();
    await page.getByRole('button', { name: 'General' }).click();
    await expectRowHeight(page.getByRole('radio', { name: 'Metric (kg)' }), 56);
    await expectFontSize(page.getByText('Metric (kg)', { exact: true }), 16);

    await page.getByRole('button', { name: 'Back to Settings' }).click();
    await page.getByRole('button', { name: 'Backup & Export' }).click();
    await expectRowHeight(page.getByRole('button', { name: 'Create backup' }), 56);
    await expectRowHeight(page.getByRole('button', { name: 'Export workout data' }), 68);
    await expectFontSize(page.getByText('Create backup', { exact: true }), 16);

    await page.getByRole('button', { name: 'Back to Settings' }).click();
    await page.getByRole('button', { name: 'About' }).click();
    await expectRowHeight(page.getByRole('button', { name: 'Source code' }), 56);
  });

  test('uses the enlarged semantic icon scale on Settings and About rows', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await expect(page.getByTestId('settings-main-exercises-row').locator('svg').first()).toHaveAttribute('width', '26');

    await page.getByRole('button', { name: 'About' }).click();
    await expect(page.getByRole('button', { name: 'Source code' }).locator('svg').first()).toHaveAttribute('width', '26');
    await expect(page.getByRole('button', { name: 'License: GPL v3.0' }).locator('svg').first()).toHaveAttribute('width', '26');
  });

  test('persists the first day of the week and applies it to the Calendar', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'General' }).click();
    await page.getByRole('radio', { name: 'Sunday' }).click();
    await page.getByRole('button', { name: 'Back to Settings' }).click();
    await expect(page.getByRole('button', { name: 'General' })).toBeVisible();

    await page.getByRole('tab', { name: 'Dashboard' }).click();
    await expect(page.locator('[data-testid="calendar-selected-day"]').last()).toBeVisible();
    await expect(page.getByTestId('calendar-weekdays').last()).toHaveText('SMTWTFS');
    await page.reload();
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'General' }).click();
    await expect(page.getByRole('radio', { name: 'Sunday' })).toBeVisible();
  });

  test('uses the shared single-choice picker for General selections', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'General' }).click();

    await page.getByRole('button', { name: 'Default rest time' }).click();
    await expect(page.getByTestId('default-rest-selection-sheet')).toBeVisible();
    const defaultRestList = page.getByTestId('default-rest-selection-list');
    const defaultRestBox = await defaultRestList.boundingBox();
    expect(defaultRestBox?.height ?? Infinity).toBeLessThanOrEqual(52 * 6 + 0.1);
    expect(defaultRestBox?.height ?? 0).toBeGreaterThanOrEqual(52 * 4);
    await expect(defaultRestList).toHaveAttribute('role', 'radiogroup');
    await expect(page.getByRole('radio', { name: '01:30' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.getByRole('radio', { name: '02:00' }).click();
    await expect(page.getByTestId('default-rest-selection-sheet')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Default rest time' })).toContainText('02:00');
    await page.getByRole('button', { name: 'Default rest time' }).click();
    await expect(page.getByRole('radio', { name: '02:00' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.getByRole('radio', { name: '02:00' }).click();

    await page.getByRole('switch', { name: 'Unfinished workout reminder' }).click();
    await page.getByRole('button', { name: 'Remind after' }).click();
    await expect(page.getByTestId('reminder-selection-sheet')).toBeVisible();
    const reminderList = page.getByTestId('reminder-selection-list');
    const reminderBox = await reminderList.boundingBox();
    expect(reminderBox?.height).toBeCloseTo(52 * 4, 0);
    await page.getByRole('radio', { name: '1 hour' }).click();
    await expect(page.getByTestId('reminder-selection-sheet')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Remind after' })).toContainText('1 hour');

    await page.getByRole('button', { name: 'Appearance' }).click();
    const viewport = page.viewportSize();
    if ((viewport?.width ?? 0) >= 768) {
      await expect(page.getByTestId('appearance-selection-sheet')).toHaveCount(0);
    } else {
      await expect(page.getByTestId('appearance-selection-sheet')).toBeVisible();
      const appearanceBox = await page.getByTestId('appearance-selection-list').boundingBox();
      expect(appearanceBox?.height).toBeCloseTo(52 * 3, 0);
    }
    await page.getByRole('radio', { name: 'Dark' }).click();
    await expect(page.getByRole('button', { name: 'Appearance', exact: true })).toContainText('Dark');
  });

  test('keeps a new workout type as a draft until Save', async ({ page }) => {
    await openWorkoutTypes(page);
    await expect(page.getByText('New type', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Add workout type' }).click();
    await expect(page.getByText('New workout type', { exact: true })).toBeVisible();
    const titleBox = await page.getByTestId('new-workout-type-title-wrap').boundingBox();
    const saveBox = await page.getByRole('button', { name: 'Save workout type' }).boundingBox();
    expect(titleBox).not.toBeNull();
    expect(saveBox).not.toBeNull();
    expect((titleBox?.x ?? 0) + (titleBox?.width ?? 0)).toBeLessThanOrEqual(saveBox?.x ?? 0);
    await page.getByRole('button', { name: 'Cancel new workout type' }).click();
    await expect(page.getByText('New type', { exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'Add workout type' }).click();
    await page.getByLabel('Workout type name').fill('   ');
    await expect(page.getByRole('button', { name: 'Save workout type' })).toBeDisabled();
    await expect(page.getByText('New workout type', { exact: true })).toBeVisible();
    await page.getByLabel('Workout type name').fill('Recovery');
    await page.getByRole('button', { name: 'Choose custom workout type color' }).click();
    await expect(page.getByTestId('custom-workout-type-color-picker')).toBeVisible();
    await page
      .getByRole('button', { name: /Use custom color #/ })
      .first()
      .click();
    await expect(page.getByTestId('custom-workout-type-color-picker')).toHaveCount(0);
    await page.getByRole('button', { name: 'Save workout type' }).click();
    await expect(page.getByRole('button', { name: 'Recovery workout type' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Recovery workout type' })).toHaveCount(1);
  });

  test('guards a changed workout type draft on Cancel', async ({ page }) => {
    await openWorkoutTypes(page);
    await page.getByRole('button', { name: 'Add workout type' }).click();
    await page.getByLabel('Workout type name').fill('Recovery');
    await page.getByRole('button', { name: 'Cancel new workout type' }).click();
    await expect(page.getByText('New workout type', { exact: true })).toBeVisible();
  });
});
