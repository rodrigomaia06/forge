import { expect, test } from '@playwright/test';

test('startup logo corners blend into the loading surface', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    // Expo bypasses font readiness for Safari/iOS user agents. Use its observed
    // loading path for this startup-only capture, retaining the phone viewport
    // and browser engine, then hold the font observer pending.
    Object.defineProperty(navigator, 'userAgent', { value: 'Chrome ForgeStartupCapture' });
    document.fonts.load = () => new Promise<FontFace[]>(() => {});
  });
  await page.goto('/');
  const loading = page.getByLabel('Loading Forge');
  await expect(loading).toBeVisible();
  await expect(loading).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(loading.locator('img').locator('..')).toHaveCSS('border-radius', '0px');
  await loading.screenshot({ path: testInfo.outputPath('startup-logo-corners.png') });
});
