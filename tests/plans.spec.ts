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

test.describe('Plans and routines', () => {
  test('routes the Dashboard creation action into the Plans creation popover', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Start workout' }).click();
    await expect(page.getByText('Plans', { exact: true })).toBeVisible();
    await expect(page.getByTestId('plans-creation-popover')).toBeVisible();
    await expect(
      page
        .getByTestId('plans-creation-popover')
        .getByRole('button', { name: 'New workout', exact: true }),
    ).toBeVisible();
  });

  test('starts a blank workout and creates a plan from the header popover', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Plans' }).click();
    await page.getByRole('button', { name: 'Create workout, routine, or plan' }).click();
    await page
      .getByTestId('plans-creation-popover')
      .getByRole('button', { name: 'New workout plan', exact: true })
      .click();
    await expect(page.getByText('New plan', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Create workout, routine, or plan' }).click();
    await page
      .getByTestId('plans-creation-popover')
      .getByRole('button', { name: 'New workout', exact: true })
      .click();
    await expect(page.getByRole('button', { name: 'Finish workout' })).toBeVisible();
  });

  test('creates a routine, edits it, and starts it as a workout', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Plans' }).click();
    await page.getByRole('button', { name: 'Create workout, routine, or plan' }).click();
    const menu = page.getByTestId('plans-creation-popover');
    await expect(menu.getByRole('button', { name: 'New workout', exact: true })).toBeVisible();
    await expect(menu.getByRole('button', { name: 'New routine', exact: true })).toBeVisible();
    await expect(menu.getByRole('button', { name: 'New workout plan', exact: true })).toBeVisible();
    await menu.getByRole('button', { name: 'New routine', exact: true }).click();
    await expect(page.getByText('Edit routine')).toBeVisible();
    await page.getByLabel('Routine name').fill('Upper body');
    await page.getByRole('button', { name: 'Back to Plans' }).click();
    await expect(page.getByText('Upper body')).toBeVisible();
    await page.getByRole('button', { name: 'Start Upper body' }).click();
    await expect(page.getByLabel('Finish workout')).toBeVisible();
  });

  test('uses type icons and supports swipe deletion for routines and plans', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Plans' }).click();
    await page.getByRole('button', { name: 'Create workout, routine, or plan' }).click();
    await page
      .getByTestId('plans-creation-popover')
      .getByRole('button', { name: 'New routine' })
      .click();
    await page.getByLabel('Routine name').fill('Swipe routine');
    await page.getByRole('button', { name: 'Back to Plans' }).click();

    const routine = page.locator('[data-testid^="routine-swipe-"]').first();
    await expect(
      routine.getByRole('button', { name: 'Start Swipe routine' }).locator('svg'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create standalone routine' })).toHaveCount(0);
    await swipeLeftFrom(page, routine);
    const deleteRoutine = page.getByRole('button', { name: 'Delete Swipe routine' });
    await expect(deleteRoutine).toBeVisible();
    await deleteRoutine.click();
    await expect(page.getByText('Swipe routine', { exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'Create workout, routine, or plan' }).click();
    await page
      .getByTestId('plans-creation-popover')
      .getByRole('button', { name: 'New workout plan' })
      .click();
    const plan = page.locator('[data-testid^="plan-swipe-"]').first();
    await swipeLeftFrom(page, plan);
    const deletePlan = page.getByRole('button', { name: 'Delete New plan' });
    await expect(deletePlan).toBeVisible();
    await deletePlan.click();
    await expect(page.getByText('New plan', { exact: true })).toHaveCount(0);
  });
});
