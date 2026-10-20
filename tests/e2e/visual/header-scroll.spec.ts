import { expect, test, type Page } from '@playwright/test';

async function scrollVisiblePage(page: Page, testID?: string) {
  if (testID) {
    await expect
      .poll(() =>
        page.getByTestId(testID).evaluate((element) => {
          for (let node: Element | null = element; node; node = node.parentElement) {
            const style = getComputedStyle(node);
            if (Number(style.opacity) < 0.99) return false;
          }
          return true;
        }),
      )
      .toBe(true);
  }
  return page.evaluate((id) => {
    const root = id ? document.querySelector(`[data-testid="${id}"]`) : document;
    const scroller = [
      ...(root?.querySelectorAll('*') ?? []),
      ...(root instanceof Element ? [root] : []),
    ].find(
      (node) =>
        /auto|scroll/.test(getComputedStyle(node).overflowY) &&
        node.scrollHeight > node.clientHeight + 1,
    );
    if (!scroller) throw new Error('Missing overflowing page');
    scroller.scrollTop = 120;
    scroller.dispatchEvent(new Event('scroll'));
    return scroller.scrollTop;
  }, testID);
}

for (const appearance of ['light', 'dark']) {
  test(`scrolled root and settings headers stay unlined (${appearance})`, async ({
    page,
  }, info) => {
    await page.addInitScript((appearance) => {
      localStorage.setItem(
        '@forge/settings-preferences',
        JSON.stringify({
          appearance,
          workoutTypes: Array.from({ length: 20 }, (_, index) => ({
            id: `header-type-${index}`,
            name: index === 0 ? 'Martial arts' : `Type ${index + 1}`,
            color: '#C56A6A',
            source: 'custom',
          })),
        }),
      );
      localStorage.setItem(
        '@forge/plans-v1',
        JSON.stringify({
          plans: [],
          standaloneRoutines: Array.from({ length: 18 }, (_, index) => ({
            id: `header-routine-${index}`,
            name: index === 1 ? 'Muay Thai' : `Routine ${index + 1}`,
            type: 'Martial arts',
            exercises: [],
          })),
        }),
      );
    }, appearance);
    await page.goto('/');
    await page.getByRole('tab', { name: 'Plans', exact: true }).click();
    await expect(page.getByRole('button', { name: /Muay Thai/ }).first()).toBeVisible();
    expect(await scrollVisiblePage(page, 'plans-scroll')).toBeGreaterThan(0);
    await expect(page.getByTestId('header-edge')).toHaveCount(0);
    await page.screenshot({ path: info.outputPath(`scrolled-plans-header-${appearance}.png`) });
    await page.getByRole('tab', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Workout types', exact: true }).click();
    await expect(page.getByTestId('workout-types-scroll')).toBeVisible();
    for (const name of ['Back to Settings', 'Add workout type']) {
      const surface = page.getByRole('button', { name, exact: true }).locator('..');
      await expect(surface).toHaveCSS(
        'background-color',
        appearance === 'light' ? 'rgb(244, 244, 244)' : 'rgb(43, 47, 52)',
      );
      await expect(surface).toHaveCSS('border-radius', '22px');
      await expect(surface).toHaveCSS('width', '44px');
    }
    await page.screenshot({ path: info.outputPath(`workout-types-buttons-${appearance}.png`) });
    expect(await scrollVisiblePage(page, 'workout-types-scroll')).toBeGreaterThan(0);
    await expect(page.getByTestId('header-edge')).toHaveCount(0);
    await page.screenshot({ path: info.outputPath(`scrolled-settings-header-${appearance}.png`) });
  });
}
