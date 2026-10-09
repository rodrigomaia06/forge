import { expect, test } from '@playwright/test';

for (const appearance of ['light', 'dark'] as const) {
test(`${appearance} startup logo corners blend into the loading surface`, async ({ page }, testInfo) => {
  await page.addInitScript((appearance) => localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance })), appearance);
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
  await expect(loading.locator('img')).toHaveAttribute('src', /forge-app-icon-ios/);
  const opaqueEdges = await loading.locator('img').evaluate(async (image) => {
    const img = image as HTMLImageElement;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const context = canvas.getContext('2d')!;
    context.drawImage(img, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
      if (x > 0 && y > 0 && x < canvas.width - 1 && y < canvas.height - 1) continue;
      const offset = (y * canvas.width + x) * 4;
      if ([0, 1, 2, 3].some((channel) => data[offset + channel] !== 255)) return false;
    }
    return true;
  });
  expect(opaqueEdges).toBe(true);
  await loading.screenshot({ path: testInfo.outputPath('startup-logo-corners.png') });
});
}
