import { expect, test } from '@playwright/test';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

for (const appearance of ['light', 'dark']) {
  test(`calendar view toggle is a visible button and empty days add a historical workout (${appearance})`, async ({ page }, info) => {
    await page.addInitScript(appearance => {
      localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance }));
      localStorage.setItem('@forge/completed-workouts', JSON.stringify([]));
    }, appearance);
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Calendar', exact: true }).click();
    const toggle = page.getByRole('button', { name: 'Calendar view: Month. Toggle', exact: true });
    await expect(toggle).toBeVisible();
    // The toggle must paint a control surface distinct from the header behind it.
    const header = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const fills = await toggle.evaluate(node => {
      const colors: string[] = [];
      for (let el: Element | null = node; el && colors.length < 4; el = el.parentElement) colors.push(getComputedStyle(el).backgroundColor);
      return colors;
    });
    expect(fills.some(color => color !== 'rgba(0, 0, 0, 0)' && color !== header)).toBe(true);
    await page.waitForTimeout(300);
    await page.screenshot({ path: info.outputPath(`calendar-toggle-${appearance}.png`) });

    const today = await page.evaluate(() => ({ day: new Date().getDate(), month: new Date().getMonth() }));
    const label = `${today.day} ${MONTHS[today.month]}, add workout`;
    await page.getByRole('button', { name: label, exact: true }).click();
    const chooser = page.getByTestId('historical-workout-source-chooser');
    await expect(chooser.getByRole('button', { name: 'Blank workout', exact: true })).toBeVisible();
    await page.waitForTimeout(350);
    await page.screenshot({ path: info.outputPath(`calendar-add-chooser-${appearance}.png`) });
    await page.getByRole('button', { name: 'Close historical workout source chooser', exact: true }).first().click();
    await expect(page.getByRole('button', { name: 'Calendar view: Month. Toggle', exact: true })).toBeVisible();
  });
}
