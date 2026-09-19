import { expect, test, type Page } from '@playwright/test';

async function captureDiagnostic(
  page: Page,
  name: string,
  mutate: (page: Page) => Promise<void>,
): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('dashboard-shell')).toBeVisible();
  await mutate(page);
  await page.screenshot({
    path: test.info().outputPath(`dashboard-${name}.png`),
    fullPage: true,
  });
}

test.describe('Dashboard dock diagnostics', () => {
  test('captures each suspected layer in isolation', async ({ page }) => {
    await captureDiagnostic(page, 'base', async () => {});

    await captureDiagnostic(page, 'without-dock-cylinder', async (currentPage) => {
      await currentPage.getByTestId('dashboard-dock-cylinder').evaluate((element) => {
        element.style.visibility = 'hidden';
      });
    });

    await captureDiagnostic(page, 'marked-dock-slot', async (currentPage) => {
      await currentPage.getByTestId('dashboard-dock-slot').evaluate((element) => {
        element.style.backgroundColor = 'rgba(220, 40, 40, 0.35)';
      });
    });

    await captureDiagnostic(page, 'without-active-selection', async (currentPage) => {
      await currentPage.getByTestId('dashboard-nav-active').evaluate((element) => {
        element.style.backgroundColor = 'transparent';
      });
    });

    await captureDiagnostic(page, 'without-navigation-labels', async (currentPage) => {
      await currentPage.locator('[data-testid^="dashboard-nav-label-"]').evaluateAll((elements) => {
        elements.forEach((element) => {
          element.style.visibility = 'hidden';
        });
      });
    });
  });
});
