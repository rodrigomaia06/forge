const { test, expect } = require('@playwright/test');

test.describe('Dashboard', () => {
  test('matches the iPhone visual baseline', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Dashboard').first()).toBeVisible();
    await expect(page).toHaveScreenshot('dashboard.png', { fullPage: true });
  });
});
