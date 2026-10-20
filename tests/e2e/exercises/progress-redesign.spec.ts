import { expect, test, type Page } from '@playwright/test';

async function openProgress(
  page: Page,
  appearance: string,
  mode = 'weight-reps',
  units = 'metric',
  name = 'Dumbbell Shoulder Press',
) {
  await page.addInitScript(
    ({ appearance, mode, units, name }) => {
      localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance, units }));
      const ex = {
        id: 'stats-exercise',
        exerciseId: 'stats-catalogue',
        name,
        trackingType: mode,
        exerciseSnapshot: {
          id: 'stats-catalogue',
          name,
          trackingType: mode,
          category: 'Shoulders',
          primaryMuscle: 'Front delts',
          equipment: ['Dumbbell'],
        },
        sets: [{ id: 'stats-set', completed: false, weight: '60', reps: '20' }],
      };
      localStorage.setItem(
        '@forge/active-workout',
        JSON.stringify({
          id: 'stats-live',
          name: 'Shoulders',
          type: 'Strength',
          note: '',
          startedAt: Date.now(),
          completedAt: null,
          exercises: [ex],
        }),
      );
      localStorage.setItem(
        '@forge/completed-workouts',
        JSON.stringify(
          [40, 50, 60].map((weight, i) => ({
            id: `stats-${i}`,
            name: `Shoulders ${i}`,
            type: 'Strength',
            note: '',
            startedAt: Date.now() - [12, 6, 2][i] * 86400000,
            completedAt: Date.now() - [12, 6, 2][i] * 86400000 + 60000,
            exercises: [
              {
                ...ex,
                sets: [
                  { id: `set-${i}`, weight: `${weight}`, reps: '20', completed: true },
                  { id: `warmup-${i}`, weight: '500', reps: '20', tag: 'Warm Up', completed: true },
                ],
              },
            ],
          })),
        ),
      );
    },
    { appearance, mode, units, name },
  );
  await page.goto('/');
  await page.getByRole('button', { name: `More options for ${name}`, exact: true }).click();
  await page.getByRole('button', { name: 'Exercise info', exact: true }).click();
  await page.getByRole('radio', { name: 'Progress', exact: true }).click();
}

for (const appearance of ['light', 'dark']) {
  test(`long exercise names retain reachable Progress controls (${appearance})`, async ({
    page,
  }, info) => {
    const name =
      'Single-arm seated dumbbell shoulder press with a neutral grip and a very long exercise name';
    await openProgress(page, appearance, 'weight-reps', 'metric', name);
    await expect(page.getByTestId('exercise-info-name')).toHaveText(name);
    await expect(
      page.getByRole('button', { name: 'Back from exercise info', exact: true }),
    ).toBeInViewport();
    await page
      .getByRole('button', { name: 'Progress metric', exact: true })
      .scrollIntoViewIfNeeded();
    await expect(
      page.getByRole('button', { name: 'Next session point', exact: true }),
    ).toBeInViewport();
    await page.waitForTimeout(220);
    await page.screenshot({ path: info.outputPath(`progress-long-name-${appearance}.png`) });
  });

  test(`Progress cards follow period and metric, independently of scrubbing (${appearance})`, async ({
    page,
  }, info) => {
    await openProgress(page, appearance);
    const record = page.getByTestId('exercise-progress-record');
    const change = page.getByTestId('exercise-progress-change');
    await expect(record).toContainText('100 kg');
    await expect(change).toContainText('+400 kg · reps');
    await expect(change).toContainText('+50%');
    await expect(page.getByTestId('exercise-progress-card')).toContainText('1200 kg · reps');
    await expect(page.getByText('Selected session', { exact: true })).toHaveCount(0);
    await page.waitForTimeout(220);
    await page.screenshot({ path: info.outputPath(`progress-${appearance}.png`) });
    await change.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`progress-statistics-${appearance}.png`) });
    const stats = [await record.innerText(), await change.innerText()];
    await page.getByRole('button', { name: 'Previous session point', exact: true }).click();
    await expect(page.getByTestId('exercise-progress-selection')).toContainText('1000 kg · reps');
    expect([await record.innerText(), await change.innerText()]).toEqual(stats);
    await page.getByRole('button', { name: 'Progress metric', exact: true }).click();
    await page.getByRole('radio', { name: 'Weight', exact: true }).click();
    await expect(record).toContainText('100 kg');
    await expect(change).toContainText('+20 kg');
    await page.getByRole('button', { name: 'Progress date range', exact: true }).click();
    await page.getByRole('radio', { name: '7d', exact: true }).click();
    await expect(change).toContainText('+10 kg');
    await expect(change).toContainText('+20%');
    await expect(record).toContainText('100 kg');
    await page.getByRole('radio', { name: 'History', exact: true }).click();
    await expect(page.getByTestId('previous-session-card-stats-2')).toBeVisible();
    await page.getByRole('radio', { name: 'Progress', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Progress date range', exact: true }),
    ).toContainText('7d');
  });

  test(`Progress stats and controls reflow at 200% (${appearance})`, async ({ page }, info) => {
    await openProgress(page, appearance);
    await expect(page.getByTestId('exercise-progress-record')).toContainText('100 kg');
    await page.evaluate(() => {
      const enlarged = new WeakSet<HTMLElement>();
      const enlarge = () => {
        const nodes = [...document.querySelectorAll<HTMLElement>('[dir="auto"]')].filter(
          (node) => !enlarged.has(node),
        );
        const sizes = nodes.map((node) => ({
          node,
          font: parseFloat(getComputedStyle(node).fontSize),
          line: parseFloat(getComputedStyle(node).lineHeight),
        }));
        for (const { node, font, line } of sizes) {
          enlarged.add(node);
          node.style.fontSize = `${font * 2}px`;
          if (Number.isFinite(line)) node.style.lineHeight = `${line * 2}px`;
        }
      };
      enlarge();
      new MutationObserver(enlarge).observe(document.body, { childList: true, subtree: true });
    });
    const record = page.getByTestId('exercise-progress-record');
    const change = page.getByTestId('exercise-progress-change');
    await change.scrollIntoViewIfNeeded();
    await expect
      .poll(
        async () =>
          (await change.boundingBox())!.y >=
          (await record.boundingBox())!.y + (await record.boundingBox())!.height,
      )
      .toBe(true);
    expect(await change.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: info.outputPath(`progress-200-${appearance}.png`) });
    await page
      .getByRole('button', { name: 'Progress metric', exact: true })
      .scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: 'Progress metric', exact: true }).click();
    await page.getByRole('radio', { name: 'Best-set reps', exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('radio', { name: 'Best-set reps', exact: true })).toBeInViewport();
    await page.screenshot({ path: info.outputPath(`progress-menu-200-${appearance}.png`) });
  });
}

test('repetition-only exercises show a period record instead of 1RM', async ({ page }) => {
  await openProgress(page, 'dark', 'reps-only');
  await expect(page.getByTestId('exercise-progress-record')).toContainText('Period record');
  await expect(page.getByTestId('exercise-progress-record')).toContainText('20 reps');
  await expect(page.getByTestId('exercise-progress-change')).toContainText('0 reps');
});

test('1RM and variation convert to imperial units', async ({ page }) => {
  await openProgress(page, 'light', 'weight-reps', 'imperial');
  await expect(page.getByTestId('exercise-progress-record')).toContainText('220.5 lb');
  await expect(page.getByTestId('exercise-progress-change')).toContainText('+881.8 lb · reps');
});
