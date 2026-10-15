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
    const sheet = page.getByTestId('exercise-info-screen');
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
    await expect(
      page.getByRole('button', { name: 'Back to exercise info', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Back to exercise info', exact: true }).click();
    await expect(page.getByTestId('previous-session-card-progress-44')).toBeVisible();
    await expect(
      page
        .getByTestId('previous-session-card-progress-44')
        .getByRole('button', { name: 'Open Session 45', exact: true }),
    ).toBeInViewport();
    await expect
      .poll(
        async () =>
          (await page.getByTestId('previous-session-card-progress-44').boundingBox())?.height ?? 0,
      )
      .toBeGreaterThan(100);
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
  test(`exercise chart dropdowns preserve the page and recorded history (${appearance})`, async ({
    page,
  }, testInfo) => {
    await seedProgress(page, appearance);
    await page.goto('/');
    await page.getByRole('tab', { name: 'History' }).click();
    await page.getByRole('button', { name: 'Open Session 1', exact: true }).click();
    await page.getByRole('button', { name: 'More options for Barbell Bench Press' }).click();
    await page.getByRole('button', { name: 'Exercise info', exact: true }).click();
    await page.getByRole('radio', { name: 'Progress', exact: true }).click();
    const chart = page.getByTestId('exercise-progress-chart');
    await expect(chart).toBeVisible();
    const rawLine = chart
      .getByTestId('forge-line-plot')
      .first()
      .locator('path[stroke]:not([stroke="none"])')
      .first();
    await expect(rawLine).toBeAttached();
    await expect
      .poll(() =>
        rawLine.evaluate((element) => {
          const path = element as unknown as SVGPathElement;
          const matrix = path.getScreenCTM();
          const chart = element.closest('[data-testid="exercise-progress-chart"]')!;
          const markers = chart.querySelectorAll('circle');
          if (!matrix || !markers.length || path.getTotalLength() <= 0) return Infinity;
          return Math.max(
            ...[0, path.getTotalLength()].map((length, index) => {
              const point = path.getPointAtLength(length).matrixTransform(matrix);
              const marker = markers[index ? markers.length - 1 : 0].getBoundingClientRect();
              return Math.hypot(
                point.x - marker.x - marker.width / 2,
                point.y - marker.y - marker.height / 2,
              );
            }),
          );
        }),
      )
      .toBeLessThan(1);
    await expect(page.getByRole('button', { name: 'Progress metric', exact: true })).toContainText(
      'Volume',
    );
    const plot = page.getByRole('button', {
      name: 'Select a session point on the chart',
      exact: true,
    });
    const before = await page.getByTestId('exercise-progress-selection').innerText();
    const bounds = await plot.boundingBox();
    if (!bounds) throw new Error('Missing chart');
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down();
    await page.screenshot({ path: testInfo.outputPath(`exercise-chart-held-${appearance}.png`) });
    await page.mouse.move(bounds.x + bounds.width * 0.35, bounds.y + bounds.height / 2, {
      steps: 8,
    });
    await page.mouse.up();
    await expect(page.getByTestId('exercise-progress-selection')).not.toHaveText(before);
    await page.getByRole('button', { name: 'Previous session point' }).click();
    await page.getByRole('button', { name: 'Next session point' }).click();
    await page.getByRole('button', { name: 'Progress date range', exact: true }).click();
    await expect(chart).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to progress', exact: true })).toHaveCount(
      0,
    );
    const selectedRange = page.getByRole('radio', { name: '90d', exact: true });
    await expect(selectedRange).toHaveAttribute('aria-checked', 'true');
    expect((await selectedRange.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(
      await selectedRange.evaluate((node) => parseFloat(getComputedStyle(node).borderRadius)),
    ).toBeGreaterThan(0);
    await expect(page.getByRole('radio', { name: '7d', exact: true })).toHaveCSS(
      'background-color',
      'rgba(0, 0, 0, 0)',
    );
    const rangeBounds = await selectedRange.boundingBox();
    expect(rangeBounds!.width).toBeLessThan(160);
    expect(rangeBounds!.x).toBeGreaterThan(0);
    expect(rangeBounds!.x + rangeBounds!.width).toBeLessThan(page.viewportSize()!.width);
    await page.screenshot({
      path: testInfo.outputPath(`exercise-range-dropdown-${appearance}.png`),
    });
    await selectedRange.click();
    await expect(selectedRange).toHaveCount(0);
    await page.getByRole('button', { name: 'Progress date range', exact: true }).click();
    await page.getByRole('radio', { name: '30d', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Progress date range', exact: true }),
    ).toContainText('30d');
    await page.getByRole('button', { name: 'Progress metric', exact: true }).click();
    await expect(chart).toBeVisible();
    const metricBounds = await page
      .getByRole('radio', { name: 'Best-set reps', exact: true })
      .boundingBox();
    expect(metricBounds!.width).toBeGreaterThan(rangeBounds!.width);
    expect(metricBounds!.width).toBeLessThan(240);
    expect(
      (await page
        .getByRole('radio', { name: 'Best-set reps', exact: true })
        .getByText('Best-set reps', { exact: true })
        .boundingBox())!.height,
    ).toBeLessThan(30);
    await page.screenshot({
      path: testInfo.outputPath(`exercise-metric-dropdown-${appearance}.png`),
    });
    await page
      .getByRole('button', { name: 'Close progress metric menu', exact: true })
      .click({ position: { x: 10, y: 10 } });
    await expect(page.getByRole('radio', { name: 'Weight', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Progress metric', exact: true }).click();
    await page.getByRole('radio', { name: 'Weight', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Progress metric', exact: true })).toContainText(
      'Weight',
    );
    await page.screenshot({ path: testInfo.outputPath(`exercise-progress-${appearance}.png`) });
    await page.getByRole('radio', { name: 'History', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Session filtering/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Progress metric', exact: true })).toHaveCount(0);
    await expect
      .poll(async () => {
        const indicator = await page.getByTestId('forge-segmented-label-indicator').boundingBox();
        const tab = await page.getByRole('radio', { name: 'History', exact: true }).boundingBox();
        return indicator && tab ? Math.abs(indicator.x - tab.x) : Infinity;
      })
      .toBeLessThan(0.5);
    await page.screenshot({ path: testInfo.outputPath(`exercise-history-${appearance}.png`) });
    await page.getByRole('radio', { name: 'Info', exact: true }).click();
    await page.getByRole('button', { name: 'Change rest time, currently Default' }).click();
    const wheel = page.getByTestId('exercise-rest-selection-list');
    await expect(wheel).toBeVisible();
    expect((await wheel.boundingBox())!.height).toBeGreaterThanOrEqual(336);
    await expect
      .poll(() =>
        wheel.evaluate((element) => {
          for (let node: Element | null = element; node; node = node.parentElement) {
            const style = getComputedStyle(node);
            if (
              Number(style.opacity) < 0.99 ||
              (style.transform !== 'none' && Math.abs(new DOMMatrix(style.transform).m42) > 0.5)
            )
              return false;
          }
          return true;
        }),
      )
      .toBe(true);
    await expect(wheel).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: testInfo.outputPath(`exercise-rest-picker-${appearance}.png`) });
    await wheel.getByRole('button', { name: 'Rest duration 01:40' }).click();
    await page.getByRole('button', { name: 'Close Rest time', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Change rest time, currently 1:40' }),
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
    await expect(page.getByTestId('exercise-info-name')).toHaveText('Barbell Bench Press');
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
    await page.getByRole('button', { name: 'Close Rest time', exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Info', exact: true })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.screenshot({ path: testInfo.outputPath(`library-info-${appearance}.png`) });
    await page.getByRole('radio', { name: 'History', exact: true }).click();
    await page.getByRole('button', { name: 'Open Session 1', exact: true }).last().click();
    await expect(
      page.getByRole('button', { name: 'Back to exercise info', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Back to exercise info', exact: true }).click();
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
    await expect(page.getByTestId('exercise-info-name')).toHaveText('Barbell Bench Press');
    await page.getByRole('radio', { name: 'Progress', exact: true }).click();
    await expect(page.getByTestId('exercise-progress-selection')).toContainText('2400 kg · reps');
    await expect(page.getByText('The trend appears after 3 included sessions.')).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath(`exercise-progress-sparse-${appearance}.png`),
    });
  });
}

for (const appearance of ['light', 'dark']) {
  test(`exercise history omits incomplete sets without changing records (${appearance})`, async ({
    page,
  }, info) => {
    await seedProgress(page, appearance, 5);
    await page.addInitScript(() => {
      const workouts = JSON.parse(localStorage.getItem('@forge/completed-workouts')!);
      workouts[1].exercises[0].sets[1].completed = false;
      workouts[1].exercises[0].sets[2].sideCompletion = { left: true, right: false };
      workouts[2].exercises[0].sets.forEach((set: any) => {
        set.completed = false;
      });
      localStorage.setItem('@forge/completed-workouts', JSON.stringify(workouts));
    });
    await page.goto('/');
    await page.getByRole('tab', { name: 'History' }).click();
    await page.getByRole('button', { name: 'Open Session 1', exact: true }).click();
    await page.getByRole('button', { name: 'More options for Barbell Bench Press' }).click();
    await page.getByRole('button', { name: 'Previous sessions', exact: true }).click();
    const session = page.getByTestId('previous-session-card-progress-1');
    await expect(session.getByTestId('workout-details-set-set-1-0')).toBeVisible();
    await expect(session.getByTestId('workout-details-set-set-1-1')).toHaveCount(0);
    await expect(session.getByTestId('workout-details-set-set-1-2')).toHaveCount(0);
    await expect(
      session.getByRole('button', { name: 'Open details for set 4', exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId('previous-session-card-progress-2')).toHaveCount(0);
    await expect(page.getByText('Incomplete', { exact: true })).toHaveCount(0);
    await page.screenshot({
      path: info.outputPath(`exercise-completed-history-${appearance}.png`),
    });
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('@forge/completed-workouts')!),
    );
    expect(stored[1].exercises[0].sets).toHaveLength(6);
    expect(stored[1].exercises[0].sets[1].completed).toBe(false);
  });
}

for (const appearance of ['light', 'dark']) {
  test(`chart scrubbing captures vertical touch movement (${appearance})`, async ({
    page,
    browserName,
  }, info) => {
    await seedProgress(page, appearance);
    await page.goto('/');
    await page.getByRole('tab', { name: 'History', exact: true }).click();
    await page.getByRole('button', { name: 'Open Session 1', exact: true }).click();
    await page
      .getByRole('button', { name: 'More options for Barbell Bench Press', exact: true })
      .click();
    await page.getByRole('button', { name: 'Exercise info', exact: true }).click();
    await page.getByRole('radio', { name: 'Progress', exact: true }).click();
    const body = page.getByTestId('exercise-progress-content');
    // Keep the parent scrollable on tall phone profiles too, without changing the plot.
    await body.evaluate((node) => {
      (node.firstElementChild as HTMLElement).style.paddingBottom = '600px';
    });
    const beforeOffset = await body.evaluate((node) => node.scrollTop);
    const beforeSelection = await page.getByTestId('exercise-progress-selection').innerText();
    const plot = page.getByRole('button', {
      name: 'Select a session point on the chart',
      exact: true,
    });
    const bounds = (await plot.boundingBox())!;
    const session = browserName === 'chromium' ? await page.context().newCDPSession(page) : null;
    await expect(plot.locator('..')).toHaveCSS('touch-action', 'none');
    const drag = async (startX: number, startY: number, endX: number, endY: number) => {
      if (!session) {
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(endX, endY, { steps: 10 });
        await page.mouse.up();
        return;
      }
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: startX, y: startY }],
      });
      for (let step = 1; step <= 10; step++) {
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [
            {
              x: startX + ((endX - startX) * step) / 10,
              y: startY + ((endY - startY) * step) / 10,
            },
          ],
        });
        await page.evaluate(() => new Promise(requestAnimationFrame));
      }
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    await drag(
      bounds.x + bounds.width * 0.8,
      bounds.y + 25,
      bounds.x + bounds.width * 0.25,
      bounds.y + 160,
    );
    await expect(page.getByTestId('exercise-progress-selection')).not.toHaveText(beforeSelection);
    expect(await body.evaluate((node) => node.scrollTop)).toBe(beforeOffset);
    await page.screenshot({ path: info.outputPath(`chart-captured-gesture-${appearance}.png`) });
    if (session) await drag(8, bounds.y + 170, 8, bounds.y + 40);
    else {
      // Mobile WebKit exposes neither touch-drag nor wheel injection.
      await expect(body).toHaveCSS('overflow-y', 'auto');
      await body.evaluate((node) => {
        node.scrollTop = 180;
      });
    }
    await expect
      .poll(() => body.evaluate((node) => node.scrollTop))
      .toBeGreaterThan(beforeOffset + 20);
    await session?.detach();
  });
}
