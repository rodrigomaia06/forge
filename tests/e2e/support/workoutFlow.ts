import { expect, type Locator, type Page } from '@playwright/test';

export async function startBlankWorkout(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  await page.getByTestId('dashboard-workout-source-chooser')
    .getByRole('button', { name: 'Blank workout' })
    .click();
  // A blank workout lands on the empty session; the picker is opened explicitly.
  await expect(page.getByRole('button', { name: 'Add exercise', exact: true })).toBeVisible();
}

export async function addExerciseFromPicker(
  page: Page,
  search: string,
  checkboxName: string | RegExp,
): Promise<void> {
  await page.getByLabel('Search exercises').fill(search);
  // The native-style catalogue batches its filtered rows. Wait for that
  // render before asking Playwright to resolve the compact selection target.
  await page.waitForTimeout(80);
  const checkbox = page.getByRole('checkbox', { name: checkboxName, exact: true });
  await checkbox.scrollIntoViewIfNeeded();
  await checkbox.click();
  await page.getByRole('button', { name: 'Confirm selected exercises' }).click();
}

export async function expectVerticalOrder(first: Locator, second: Locator): Promise<void> {
  const [firstBox, secondBox] = await Promise.all([first.boundingBox(), second.boundingBox()]);
  expect(firstBox?.y).toBeLessThan(secondBox?.y ?? Number.POSITIVE_INFINITY);
}

/** Exercises the clear/blur/refocus lifecycle shared by every set-value input. */
export async function replaceClearedSetValue(input: Locator, replacement: string): Promise<void> {
  await input.fill('');
  await input.blur();
  await expect(input).toHaveValue('');
  await input.focus();
  await input.fill(replacement);
  await expect(input).toHaveValue(replacement);
}
