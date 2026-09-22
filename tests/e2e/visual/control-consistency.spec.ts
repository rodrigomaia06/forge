import { expect, test, type Locator } from '@playwright/test';

async function dimensions(locator: Locator) {
  return locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return {
      width: box.width,
      height: box.height,
      background: style.backgroundColor,
      borderWidth: style.borderWidth,
      color: style.color,
    };
  });
}

test.describe('Interactive control consistency', () => {
  test('uses shared semantic header actions, disabled treatment, and switches', async ({
    page,
  }) => {
    await page.goto('/');

    // The dashboard's start/edit actions sit in a joined ghost pill (the shared
    // live-workout treatment), so the neutral surface is on the group; the button
    // itself keeps the shared 44pt circular footprint.
    const start = page.getByRole('button', { name: 'Start workout' });
    expect(await dimensions(start)).toMatchObject({ width: 44, height: 44 });

    await page.getByRole('tab', { name: 'Plans' }).click();
    const create = page.getByRole('button', { name: 'Create workout, routine, or plan' });
    const neutralBackground = 'rgb(248, 248, 246)';
    expect(await dimensions(create)).toMatchObject({
      width: 44,
      height: 44,
      background: neutralBackground,
    });

    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Workout types' }).click();
    const backToSettings = await dimensions(page.getByRole('button', { name: 'Back to Settings' }));
    expect(backToSettings).toMatchObject({
      width: 44,
      height: 44,
      background: neutralBackground,
    });
    const addWorkoutType = page.getByRole('button', { name: 'Add workout type' });
    expect(await dimensions(addWorkoutType)).toMatchObject({
      width: 44,
      height: 44,
      background: neutralBackground,
    });
    await addWorkoutType.click();

    const save = page.getByRole('button', { name: 'Save workout type' });
    await page.getByLabel('Workout type name').fill('   ');
    await expect(save).toBeDisabled();
    expect((await dimensions(save)).height).toBe(44);
    await page.getByLabel('Workout type name').fill('Recovery');
    await expect(save).toBeEnabled();
    expect((await dimensions(save)).background).toBe(neutralBackground);

    await save.click();
    await expect(page.getByRole('button', { name: 'Recovery workout type' })).toBeVisible();
    const workoutTypesScroll = page.getByTestId('workout-types-scroll').last();
    await workoutTypesScroll.getByRole('button', { name: 'Strength workout type' }).click();
    const expandedType = workoutTypesScroll.getByTestId('workout-type-visibility-surface');
    await expect(expandedType).toHaveCSS('background-color', neutralBackground);
    await expect(expandedType).toHaveCSS('border-top-width', '1px');
    const typeSwitch = page.getByTestId('workout-type-list-visibility-switch');
    expect(await dimensions(typeSwitch)).toMatchObject({ width: 48, height: 28 });

    await page.getByRole('button', { name: 'Back to Settings' }).click();
    await page.getByRole('button', { name: 'General' }).click();
    const generalSwitch = page.getByTestId('general-switch-unfinished-workout-reminder');
    expect(await dimensions(generalSwitch)).toMatchObject({ width: 48, height: 28 });
  });

  test('keeps normal actions neutral, including Finish', async ({
    page,
  }) => {
    await page.goto('/');
    const neutralBackground = (
      await dimensions(page.getByRole('button', { name: 'Start workout' }))
    ).background;
    await page.getByRole('button', { name: 'Start workout' }).click();
    await page.getByTestId('dashboard-workout-source-chooser').getByRole('button', { name: 'Blank workout' }).click();
    await expect(page.getByTestId('add-exercise-catalogue')).toBeVisible();
    await page.getByTestId('forge-sheet-drag-area').getByRole('button', { name: 'Close add exercises' }).click();

    expect(
      (await dimensions(page.getByRole('button', { name: 'Cancel workout' }))).background,
    ).toBe(neutralBackground);
    expect((await dimensions(page.getByRole('button', { name: 'Finish workout' }))).background).toBe(
      'rgb(29, 37, 45)',
    );
  });

  test('uses monochrome controls in Dark while preserving type markers', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance: 'dark' }));
    });
    await page.goto('/');

    // The dashboard start action is a ghost button inside the joined pill; the
    // Dark neutral surface is verified on the standalone Create action below.
    const start = await dimensions(page.getByRole('button', { name: 'Start workout' }));
    expect(start).toMatchObject({ width: 44, height: 44 });

    await page.getByRole('tab', { name: 'Plans' }).click();
    const create = await dimensions(page.getByRole('button', { name: 'Create workout, routine, or plan' }));
    expect(create.background).toBe('rgb(48, 54, 59)');
    expect(create.borderWidth).toBe('0px');

    await page.getByRole('tab', { name: 'Dashboard' }).click();
    await page.getByRole('button', { name: 'Start workout' }).click();
    await page.getByTestId('dashboard-workout-source-chooser').getByRole('button', { name: 'Blank workout' }).click();
    await expect(page.getByTestId('add-exercise-catalogue')).toBeVisible();
    await page.getByTestId('forge-sheet-drag-area').getByRole('button', { name: 'Close add exercises' }).click();
    const finishButton = page.getByRole('button', { name: 'Finish workout' });
    const finish = await dimensions(finishButton);
    expect(finish.background).toBe('rgb(245, 247, 248)');
    expect((await dimensions(finishButton.getByText('Finish'))).color).toBe('rgb(23, 36, 49)');

    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'General' }).click();
    const toggle = await dimensions(page.getByTestId('general-switch-unfinished-workout-reminder'));
    await page.getByRole('switch', { name: 'Unfinished workout reminder' }).click();
    expect((await dimensions(page.getByTestId('general-switch-unfinished-workout-reminder'))).background).toBe(
      'rgb(245, 247, 248)',
    );
    expect(toggle.background).not.toBe('rgb(124, 140, 248)');

    await page.getByRole('button', { name: 'Back to Settings' }).click();
    await page.getByRole('button', { name: 'Workout types' }).click();
    const back = await dimensions(page.getByRole('button', { name: 'Back to Settings' }));
    expect(back.background).toBe('rgb(48, 54, 59)');
    expect(back.borderWidth).toBe('0px');
    const strengthColors = await page
      .getByRole('button', { name: 'Strength workout type' })
      .locator('div')
      .evaluateAll((elements) => elements.map((element) => window.getComputedStyle(element).backgroundColor));
    expect(strengthColors).toContain('rgb(124, 140, 248)');
  });

  test('uses the exact shared circular treatment for sheet Back and Close in Light', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Exercises' }).click();
    await page.getByRole('button', { name: 'All exercises, 381 exercises' }).click();
    await page.getByRole('button', { name: 'Filters' }).click();
    await page.getByRole('button', { name: 'Edit Equipment filter, Any' }).click();

    expect(await dimensions(page.getByRole('button', { name: 'Back to filters' }))).toMatchObject(
      await dimensions(page.getByRole('button', { name: 'Cancel exercise filters' })),
    );
  });

  test('uses the exact shared circular treatment for sheet Back and Close in Dark', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance: 'dark' }));
    });
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Exercises' }).click();
    await page.getByRole('button', { name: 'All exercises, 381 exercises' }).click();
    await page.getByRole('button', { name: 'Filters' }).click();
    await page.getByRole('button', { name: 'Edit Equipment filter, Any' }).click();

    expect(await dimensions(page.getByRole('button', { name: 'Back to filters' }))).toMatchObject(
      await dimensions(page.getByRole('button', { name: 'Cancel exercise filters' })),
    );
  });
});
