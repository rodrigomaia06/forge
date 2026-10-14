import { expect, test, type Locator, type Page } from '@playwright/test';

async function scrollBody(root: Locator, end = true) {
  return root.evaluate((element, toEnd) => {
    const scrollers = [element, ...element.querySelectorAll('*')].filter((node) => {
      const style = getComputedStyle(node);
      return /auto|scroll/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1;
    });
    const node = scrollers[0];
    if (!node) return { offset: 0, maximum: 0 };
    node.scrollTop = toEnd ? node.scrollHeight : 0;
    node.dispatchEvent(new Event('scroll'));
    return { offset: node.scrollTop, maximum: node.scrollHeight - node.clientHeight };
  }, end);
}

for (const appearance of ['light', 'dark']) {
  test(`previous sessions overflowing preview and expanded history (${appearance})`, async ({
    page,
  }, testInfo) => {
    await seedProgress(page, appearance);
    await page.goto('/');
    await page.getByRole('tab', { name: 'History' }).click();
    await page.getByRole('button', { name: 'Open Session 1', exact: true }).click();
    await page.getByRole('button', { name: 'More options for Barbell Bench Press' }).click();
    await page.getByRole('button', { name: 'Previous sessions', exact: true }).click();
    const sheet = page.getByRole('dialog').last();
    await expect(
      page.getByTestId('previous-sessions-scroll').getByTestId('forge-sheet-drag-area'),
    ).toHaveCount(0);
    const preview = await scrollBody(sheet);
    expect(preview.maximum).toBeGreaterThan(0);
    expect(preview.offset).toBeGreaterThan(0);
    await page.screenshot({
      path: testInfo.outputPath(`previous-sessions-preview-${appearance}.png`),
    });
    await page.getByRole('button', { name: 'Open details for set 6' }).nth(2).click();
    await expect
      .poll(() =>
        page.getByRole('button', { name: 'Close Set 6 details' }).evaluate((element) => {
          for (let node: Element | null = element; node; node = node.parentElement) {
            const style = getComputedStyle(node);
            if (Number(style.opacity) < 0.99) return false;
            if (style.transform !== 'none' && Math.abs(new DOMMatrix(style.transform).m42) > 0.5)
              return false;
          }
          return true;
        }),
      )
      .toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`previous-session-set-details-${appearance}.png`),
    });
    await page.getByRole('button', { name: 'Close Set 6 details' }).click();
    await page.getByRole('button', { name: 'Show 41 more sessions' }).click();
    const expanded = await scrollBody(sheet);
    expect(expanded.maximum).toBeGreaterThan(preview.maximum);
    await expect
      .poll(
        async () => {
          await scrollBody(sheet);
          return page.getByTestId('previous-session-card-progress-44').count();
        },
        { timeout: 10000 },
      )
      .toBe(1);
    await page
      .getByTestId('previous-session-card-progress-44')
      .getByRole('button', { name: 'Open Session 45', exact: true })
      .click();
    await expect(page.getByRole('button', { name: 'Back to History', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Back to History', exact: true }).click();
    await expect(page.getByTestId('previous-session-card-progress-44')).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`previous-sessions-expanded-${appearance}.png`),
    });
  });
}

async function seedProgress(page: Page, appearance: string, count = 45) {
  await page.addInitScript(
    ({ appearance, count }) => {
      const workouts = Array.from({ length: count }, (_, index) => ({
        id: `progress-${index}`,
        name: `Session ${index + 1}`,
        type: 'Strength',
        startedAt: Date.now() - index * 86400000 - 3600000,
        completedAt: Date.now() - index * 86400000,
        exercises: [
          {
            id: `exercise-${index}`,
            exerciseId: 'barbell-bench-press',
            name: 'Barbell Bench Press',
            trackingType: 'weight-reps',
            sets: Array.from({ length: 6 }, (_, setIndex) => ({
              id: `set-${index}-${setIndex}`,
              weight: String(index === 8 ? 500 : 50 + (index % 4)),
              reps: '8',
              completed: true,
            })),
          },
        ],
      }));
      localStorage.setItem('@forge/completed-workouts', JSON.stringify(workouts));
      localStorage.setItem('@forge/active-workout', 'null');
      localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance }));
    },
    { appearance, count },
  );
}

for (const appearance of ['light', 'dark']) {
  test(`exercise tabs, filtering, retry and chart (${appearance})`, async ({ page }, testInfo) => {
    await seedProgress(page, appearance);
    await page.goto('/');
    await page.getByRole('tab', { name: 'History' }).click();
    await page.getByRole('button', { name: 'Open Session 1', exact: true }).click();
    await page.getByRole('button', { name: 'More options for Barbell Bench Press' }).click();
    await page.getByRole('button', { name: 'Exercise info', exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Info', exact: true })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.screenshot({ path: testInfo.outputPath(`exercise-info-${appearance}.png`) });
    await page.getByRole('radio', { name: 'Progress', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('1 excluded in this range')).toBeVisible();
    await expect(page.getByTestId('exercise-progress-chart')).toBeVisible();
    await page
      .getByRole('button', { name: 'Select a session point on the chart', exact: true })
      .focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Previous session point' })).toBeDisabled();
    const keyboardSelection = await page.getByTestId('exercise-progress-selection').innerText();
    await page
      .getByRole('button', { name: 'Select a session point on the chart', exact: true })
      .click({ position: { x: 60, y: 90 } });
    await expect(page.getByTestId('exercise-progress-selection')).not.toHaveText(keyboardSelection);
    await page.getByRole('button', { name: 'Previous session point' }).click();
    await page.getByRole('button', { name: 'Next session point' }).click();
    await page.screenshot({ path: testInfo.outputPath(`exercise-progress-${appearance}.png`) });
    await page.getByRole('radio', { name: '7d', exact: true }).click();
    await expect(page.getByText('0 excluded in this range')).toBeVisible();
    await page.getByRole('radio', { name: '30d', exact: true }).click();
    await page.getByRole('radio', { name: 'All', exact: true }).click();
    await page.getByRole('radio', { name: '90d', exact: true }).click();
    await page.getByRole('button', { name: 'Progress metric' }).click();
    await page.getByRole('radio', { name: 'Session volume', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Progress metric' })).toContainText(
      'Session volume',
    );
    await page.getByRole('button', { name: 'Review history', exact: true }).click();
    await scrollBody(page.getByRole('dialog').last());
    await page.getByRole('button', { name: 'Show 41 more sessions' }).click();
    // Expanded histories remain windowed instead of mounting every set.
    await expect(page.getByTestId('exercise-history-expanded')).toBeVisible();
    expect(await page.getByTestId(/^previous-session-card-/).count()).toBeLessThan(44);
    for (let step = 0; step < 5; step++) {
      await page.getByTestId('exercise-history-expanded').evaluate((root) => {
        const scroller = [root, ...root.querySelectorAll('*')].find(
          (node) =>
            /auto|scroll/.test(getComputedStyle(node).overflowY) &&
            node.scrollHeight > node.clientHeight + 1,
        );
        if (scroller) {
          scroller.scrollTop += 700;
          scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
        }
      });
      await page.waitForTimeout(100);
      if (
        await page
          .getByRole('button', { name: 'Session filtering: Auto-filtered, Session 9', exact: true })
          .count()
      )
        break;
    }
    const anomaly = page.getByRole('button', {
      name: 'Session filtering: Auto-filtered, Session 9',
      exact: true,
    });
    await anomaly.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`exercise-history-${appearance}.png`) });
    await anomaly.click();
    await page.getByRole('radio', { name: 'Include', exact: true }).click();
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      (window as any).restoreProgressSave = () => {
        Storage.prototype.setItem = original;
      };
      Storage.prototype.setItem = function (key, value) {
        if (key === '@forge/settings-preferences') throw new Error('Injected settings failure');
        return original.call(this, key, value);
      };
    });
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(
      page.getByText('Could not save. Your selection is still here. Try again.'),
    ).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Include', exact: true })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.screenshot({
      path: testInfo.outputPath(`exercise-override-failure-${appearance}.png`),
    });
    await page.evaluate(() => (window as any).restoreProgressSave());
    await page.getByRole('button', { name: 'Retry save', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Session filtering: Included, Session 9', exact: true }),
    ).toBeVisible();
    await page.getByRole('radio', { name: 'Progress', exact: true }).click();
    await expect(page.getByText('0 excluded in this range')).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`exercise-progress-included-${appearance}.png`),
    });
    const stored = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('@forge/settings-preferences')!).exerciseProgressOverrides,
    );
    expect(Object.values(stored)).toContainEqual({ 'progress-8': 'include' });
    await page.getByRole('radio', { name: 'History', exact: true }).click();
    await page
      .getByRole('button', { name: 'Session filtering: Included, Session 9', exact: true })
      .click();
    await page.getByRole('radio', { name: 'Exclude', exact: true }).click();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Session filtering: Excluded, Session 9', exact: true }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Session filtering: Excluded, Session 9', exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath(`exercise-manual-exclusion-${appearance}.png`),
    });
    await page
      .getByRole('button', { name: 'Session filtering: Excluded, Session 9', exact: true })
      .click();
    await page.getByRole('radio', { name: 'Auto', exact: true }).click();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(
      page.getByRole('button', {
        name: 'Session filtering: Auto-filtered, Session 9',
        exact: true,
      }),
    ).toBeVisible();
  });
}

for (const appearance of ['light', 'dark']) {
  test(`library shares tabs and preserves Info and rest controls (${appearance})`, async ({
    page,
  }, testInfo) => {
    await seedProgress(page, appearance);
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Exercises', exact: true }).click();
    await page.getByRole('button', { name: 'All exercises, 608 exercises', exact: true }).click();
    await page.getByRole('button', { name: 'Bench Press & 3 variations', exact: true }).click();
    await page.getByRole('button', { name: 'Open Flat', exact: true }).first().click();
    await expect(
      page.getByRole('dialog').last().getByText('Barbell Bench Press', { exact: true }),
    ).toHaveCSS('-webkit-line-clamp', '2');
    await expect(page.getByRole('radio', { name: 'Info', exact: true })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(
      page.getByRole('button', { name: 'Change rest time, currently Default', exact: true }),
    ).toBeVisible();
    await page.getByRole('radio', { name: 'Progress', exact: true }).click();
    await expect(page.getByTestId('exercise-progress-content')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`library-progress-${appearance}.png`) });
    await page.getByRole('radio', { name: 'Info', exact: true }).click();
    await page
      .getByRole('button', { name: 'Change rest time, currently Default', exact: true })
      .click();
    await page.getByRole('button', { name: 'Back to exercise details', exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Info', exact: true })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.screenshot({ path: testInfo.outputPath(`library-info-${appearance}.png`) });
    await page.getByRole('radio', { name: 'History', exact: true }).click();
    await page.getByRole('button', { name: 'Open Session 1', exact: true }).last().click();
    await expect(
      page.getByRole('button', { name: 'Back to exercises', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Back to exercises', exact: true }).click();
    await expect(page.getByRole('radio', { name: 'History', exact: true })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(
      page.getByRole('button', { name: 'Open Session 1', exact: true }).last(),
    ).toBeVisible();
  });
}

for (const appearance of ['light', 'dark']) {
  test(`empty and single-session progress (${appearance})`, async ({ page }, testInfo) => {
    await seedProgress(page, appearance, 1);
    await page.goto('/');
    await page.getByRole('tab', { name: 'History' }).click();
    await page.getByRole('button', { name: 'Open Session 1', exact: true }).click();
    await page.getByRole('button', { name: 'More options for Barbell Bench Press' }).click();
    await page.getByRole('button', { name: 'Exercise info', exact: true }).click();
    await page.getByRole('radio', { name: 'Progress', exact: true }).click();
    await expect(page.getByText('Complete working sets to see progress.')).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`exercise-progress-empty-${appearance}.png`),
    });
    await page.getByRole('radio', { name: 'History', exact: true }).click();
    await expect(page.getByText('No completed sessions for this exercise yet.')).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`exercise-history-empty-${appearance}.png`),
    });
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Exercises', exact: true }).click();
    await page.getByRole('button', { name: 'All exercises, 608 exercises', exact: true }).click();
    await page.getByRole('button', { name: 'Bench Press & 3 variations', exact: true }).click();
    await page.getByRole('button', { name: 'Open Flat', exact: true }).first().click();
    await expect(
      page.getByRole('dialog').last().getByText('Barbell Bench Press', { exact: true }),
    ).toHaveCSS('-webkit-line-clamp', '2');
    await page.getByRole('radio', { name: 'Progress', exact: true }).click();
    await expect(page.getByText('Latest session · 1 point')).toBeVisible();
    await expect(page.getByText('The trend appears after 3 included sessions.')).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`exercise-progress-sparse-${appearance}.png`),
    });
  });
}
