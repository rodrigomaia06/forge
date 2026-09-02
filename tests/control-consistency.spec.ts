import { expect, test, type Locator } from '@playwright/test';

async function dimensions(locator: Locator) {
  return locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return {
      width: box.width,
      height: box.height,
      background: style.backgroundColor,
      color: style.color,
    };
  });
}

test.describe('Interactive control consistency', () => {
  test('uses shared semantic header actions, disabled treatment, and switches', async ({
    page,
  }) => {
    await page.goto('/');

    const start = page.getByRole('button', { name: 'Start workout' });
    const startMetrics = await dimensions(start);
    expect(startMetrics).toMatchObject({
      width: 44,
      height: 44,
      background: 'rgb(248, 248, 246)',
    });

    await page.getByRole('tab', { name: 'Plans' }).click();
    const create = page.getByRole('button', { name: 'Create workout, routine, or plan' });
    expect(await dimensions(create)).toMatchObject({
      width: 44,
      height: 44,
      background: startMetrics.background,
    });

    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Workout types' }).click();
    const addWorkoutType = page.getByRole('button', { name: 'Add workout type' });
    expect(await dimensions(addWorkoutType)).toMatchObject({
      width: 44,
      height: 44,
      background: startMetrics.background,
    });
    await addWorkoutType.click();

    const save = page.getByRole('button', { name: 'Save workout type' });
    await page.getByLabel('Workout type name').fill('   ');
    await expect(save).toBeDisabled();
    expect((await dimensions(save)).height).toBe(44);
    await page.getByLabel('Workout type name').fill('Recovery');
    await expect(save).toBeEnabled();
    expect((await dimensions(save)).background).toBe(startMetrics.background);

    await save.click();
    await expect(page.getByRole('button', { name: 'Recovery workout type' })).toBeVisible();
    await page.getByRole('button', { name: 'Strength workout type' }).click();
    const typeSwitch = page.getByTestId('workout-type-list-visibility-switch');
    expect(await dimensions(typeSwitch)).toMatchObject({ width: 48, height: 28 });

    await page.getByRole('button', { name: 'Back to Settings' }).click();
    await page.getByRole('button', { name: 'General' }).click();
    const generalSwitch = page.getByTestId('general-switch-unfinished-workout-reminder');
    expect(await dimensions(generalSwitch)).toMatchObject({ width: 48, height: 28 });
  });

  test('keeps cancel neutral and uses workout context for the primary finish action', async ({
    page,
  }) => {
    await page.goto('/');
    const neutralBackground = (
      await dimensions(page.getByRole('button', { name: 'Start workout' }))
    ).background;

    await page.getByRole('button', { name: 'Start workout' }).click();
    await page
      .getByTestId('plans-creation-popover')
      .getByRole('button', { name: 'New workout', exact: true })
      .click();

    expect(
      (await dimensions(page.getByRole('button', { name: 'Cancel workout' }))).background,
    ).toBe(neutralBackground);
    expect(
      (await dimensions(page.getByRole('button', { name: 'Finish workout' }))).background,
    ).toBe('rgb(111, 127, 242)');
  });
});
