import { expect, test } from '@playwright/test';

test('keeps calendar workout days distinct in Light and Dark', async ({ page }) => {
  await page.goto('/');
  const capture = async () =>
    page.getByRole('button', { name: '3 August 2026, workout recorded', exact: true }).evaluate((element) => {
      const day = Array.from(element.querySelectorAll('*')).find((candidate) => {
        const style = window.getComputedStyle(candidate);
        return style.backgroundColor !== 'rgba(0, 0, 0, 0)';
      });
      const style = day ? window.getComputedStyle(day) : null;
      return { background: style?.backgroundColor, border: style?.borderColor };
    });
  const light = await capture();
  expect(light.background).not.toBe('rgba(0, 0, 0, 0)');
  await page.getByRole('tab', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'General' }).click();
  await page.getByRole('button', { name: 'Appearance' }).click();
  await page.getByRole('radio', { name: 'Dark' }).click();
  await page.getByRole('button', { name: 'Back to Settings' }).click();
  await page.getByRole('tab', { name: 'Dashboard' }).click();
  const dark = await capture();
  expect(dark.background).not.toBe(light.background);
  expect(dark.border).not.toBe(light.border);
});
