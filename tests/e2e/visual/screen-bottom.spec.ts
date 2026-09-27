import { expect, test, type Page } from '@playwright/test';

const viewport = { width: 390, height: 700 };
const bottomInset = 34;

async function applyPhoneInsets(page: Page) {
  await page.locator('body > div').filter({ visible: false }).evaluateAll((elements) => {
    const probe = elements.find((element) =>
      (element as HTMLElement).style.paddingTop.includes('safe-area-inset-top'),
    ) as HTMLElement | undefined;
    if (!probe) throw new Error('Expected the safe-area provider measurement element');
    probe.style.paddingTop = '62px';
    probe.style.paddingBottom = '34px';
    probe.dispatchEvent(new Event('transitionend'));
  });
}

const settingsRoutes = [
  ['Exercises'],
  ['Exercises', 'All exercises, 608 exercises'],
  ['Exercises', 'Custom exercises, 0 exercises'],
  ['Workout types'],
  ['Workout types', 'Strength workout type'],
  ['General'],
  ['Measurements'],
  ['Backup & Export'],
  ['Logs'],
  ['About'],
];

test.describe('Page bottom safe areas', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      const completedAt = Date.now() - 3600000;
      localStorage.setItem('@forge/completed-workouts', JSON.stringify([{
        id: 'bottom-layout-workout', name: 'Bottom layout session', type: 'Strength',
        startedAt: completedAt - 3600000, completedAt, durationSeconds: 3600,
        note: '', attributes: {}, exercises: [],
      }]));
    });
    await page.goto('/');
    await expect(page.getByTestId('dashboard-shell')).toBeVisible();
    await applyPhoneInsets(page);
  });

  for (const tab of ['Dashboard', 'History', 'Plans', 'Settings']) {
    test(`extends the ${tab} tab through the bottom safe area`, async ({ page }) => {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      await expectPageBottom(page);
    });
  }

  test('extends Live Workout through the bottom safe area', async ({ page }) => {
    await page.getByRole('tab', { name: 'Plans' }).click();
    await page.getByRole('button', { name: 'Create workout, routine, or plan' }).click();
    await page.getByTestId('plans-creation-popover').getByRole('button', { name: 'New workout', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Add exercise' })).toBeVisible();
    await expectPageBottom(page);
  });

  for (const route of settingsRoutes) {
    test(`extends Settings → ${route.join(' → ')} through the bottom safe area`, async ({ page }) => {
      await page.getByRole('tab', { name: 'Settings' }).click();
      for (const name of route) await page.getByRole('button', { name, exact: true }).click();
      await expectPageBottom(page);
    });
  }

  for (const editing of [false, true]) {
    test(`extends workout ${editing ? 'editor' : 'details'} through the bottom safe area`, async ({ page }) => {
      await page.getByRole('tab', { name: 'History' }).click();
      await page.getByRole('button', { name: 'Open Bottom layout session' }).click();
      if (editing) {
        await page.getByRole('button', { name: 'Workout options' }).click();
        await page.getByRole('button', { name: 'Edit workout' }).click();
        await expect(page.getByLabel('Workout name')).toBeVisible();
      }
      await expectPageBottom(page);
    });
  }

  test('extends the routine editor through the bottom safe area', async ({ page }, testInfo) => {
    await page.getByRole('tab', { name: 'Plans' }).click();
    await page.getByRole('button', { name: 'Create workout, routine, or plan' }).click();
    const menu = page.getByTestId('plans-creation-popover');
    await menu.getByRole('button', { name: 'New routine', exact: true }).click();
    await expect(menu).toHaveCount(0);
    await expect(page.getByLabel('Routine name')).toBeVisible();
    await expectPageBottom(page);
    if (testInfo.project.use.isMobile === true) {
      await page.screenshot({ path: testInfo.outputPath('routine-editor-bottom-safe-area.png') });
    }
  });
});

async function expectPageBottom(page: Page) {
  // Measure the visible page's real scroll viewport, including short pages
  // whose content does not yet require scrolling. Hidden tab scenes are ignored.
  await expect.poll(async () => page.locator('div').evaluateAll((elements) => {
    const scrollers = elements.filter((element) => {
      const bounds = element.getBoundingClientRect();
      for (let parent: Element | null = element; parent; parent = parent.parentElement) {
        if (parseFloat(getComputedStyle(parent).opacity) < 1) return false;
      }
      return bounds.height > 200 && bounds.width > 300
        && /auto|scroll/.test(getComputedStyle(element).overflowY);
    });
    return scrollers.map((element) => ({
      bottom: Math.round(element.getBoundingClientRect().bottom),
      trailing: parseFloat(getComputedStyle(element.firstElementChild!).paddingBottom),
    }));
  })).toEqual([{ bottom: viewport.height, trailing: expect.any(Number) }]);

  const trailing = await page.locator('div').evaluateAll((elements) => {
    const scroller = elements.find((element) => {
      const box = element.getBoundingClientRect();
      for (let parent: Element | null = element; parent; parent = parent.parentElement) {
        if (parseFloat(getComputedStyle(parent).opacity) < 1) return false;
      }
      return box.height > 200 && box.width > 300 && /auto|scroll/.test(getComputedStyle(element).overflowY);
    });
    return parseFloat(getComputedStyle(scroller!.firstElementChild!).paddingBottom);
  });
  expect(trailing).toBeGreaterThanOrEqual(bottomInset);
}
