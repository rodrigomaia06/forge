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

test('uses a neutral selection ring that preserves workout markers in Light and Dark', async ({ page }) => {
  await page.goto('/');
  const selectedPresentation = async () => {
    const [ring, text] = await Promise.all([
      page
        .getByTestId('calendar-selected-ring')
        .last()
        .evaluate((element) => window.getComputedStyle(element).borderColor),
      page.getByTestId('calendar-selected-day').last().evaluate((element) => {
        const textNode = Array.from(element.querySelectorAll<HTMLElement>('*')).find(
          (candidate) => candidate.children.length === 0 && candidate.textContent?.trim() === element.textContent?.trim(),
        );
        return textNode ? window.getComputedStyle(textNode).color : null;
      }),
    ]);
    return { ring, text };
  };

  expect(await selectedPresentation()).toEqual({ ring: 'rgb(29, 37, 45)', text: 'rgb(23, 25, 28)' });

  await page.getByRole('tab', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'General' }).click();
  await page.getByRole('button', { name: 'Appearance' }).click();
  await page.getByRole('radio', { name: 'Dark' }).click();
  await page.getByRole('button', { name: 'Back to Settings' }).click();
  await page.getByRole('tab', { name: 'Dashboard' }).click();

  expect(await selectedPresentation()).toEqual({ ring: 'rgba(245, 247, 248, 0.62)', text: 'rgb(247, 248, 246)' });

  await page.getByRole('button', { name: '3 August 2026, workout recorded', exact: true }).click();
  await expect(page.getByTestId('calendar-marker-3-0')).toHaveCSS('background-color', 'rgb(104, 124, 242)');
});
