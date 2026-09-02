import { expect, test, type Locator } from '@playwright/test';

async function dimensions(locator: Locator) {
  return locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return { width: box.width, height: box.height, background: style.backgroundColor, color: style.color };
  });
}

test.describe('Interactive control consistency', () => {
  test('uses shared semantic header actions, disabled treatment, and switches', async ({ page }) => {
    await page.goto('/');

    const start = page.getByRole('button', { name: 'Start workout' });
    expect(await dimensions(start)).toMatchObject({ width: 44, height: 44 });

    await page.getByRole('tab', { name: 'Plans' }).click();
    const create = page.getByRole('button', { name: 'Create workout, routine, or plan' });
    expect(await dimensions(create)).toMatchObject({ width: 44, height: 44 });

    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Workout types' }).click();
    await page.getByRole('button', { name: 'Add workout type' }).click();

    const save = page.getByRole('button', { name: 'Save workout type' });
    await page.getByLabel('Workout type name').fill('   ');
    await expect(save).toBeDisabled();
    expect((await dimensions(save)).height).toBe(44);
    await page.getByLabel('Workout type name').fill('Recovery');
    await expect(save).toBeEnabled();
    expect((await dimensions(save)).background).not.toBe('rgba(0, 0, 0, 0)');

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
});
