import { expect, test } from '@playwright/test';
import appConfig from '../../../app.json';

for (const appearance of ['light', 'dark']) {
  test(`About displays the bundled version and commit (${appearance})`, async ({ page }, info) => {
    await page.addInitScript(appearance => {
      localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance }));
    }, appearance);
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'About', exact: true }).click();
    const commit = process.env.EXPO_PUBLIC_BUILD_COMMIT?.slice(0, 7);
    const title = page.getByTestId('about-build-version');
    await expect(title).toHaveText(`Forge ${appConfig.expo.version}${commit ? ` (${commit})` : ''}`);
    const titleBounds = (await title.boundingBox())!;
    expect(titleBounds.x + titleBounds.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    await page.waitForTimeout(300);
    await page.screenshot({ path: info.outputPath(`about-version-${appearance}.png`) });
  });
}
