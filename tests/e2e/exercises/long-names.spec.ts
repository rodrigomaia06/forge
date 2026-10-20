import { expect, test } from '@playwright/test';

const title = 'Single-Arm Dumbbell Triceps Extension With A Very Long Exercise Name';
for (const appearance of ['light', 'dark']) {
  test(`long variation titles preserve trailing controls (${appearance})`, async ({
    page,
  }, info) => {
    await page.addInitScript(
      ({ appearance, title }) => {
        localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance }));
        localStorage.setItem(
          '@forge/custom-exercises',
          JSON.stringify(
            [title, 'Dumbbell Triceps Kickback'].map((name, index) => ({
              id: `custom-long-${index}`,
              name,
              group: 'Long triceps',
              category: 'Triceps',
              equipment: 'Dumbbell',
              primaryEquipment: 'Dumbbell',
              variation: name,
              trackingType: 'weight-reps',
              workoutTypeIds: ['strength'],
              aliases: [],
              primaryMuscle: 'Triceps',
              secondaryMuscles: [],
              laterality: 'unilateral',
            })),
          ),
        );
      },
      { appearance, title },
    );
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Exercises', exact: true }).click();
    await page.getByRole('button', { name: /^All exercises, \d+ exercises$/ }).click();
    await expect(page.getByTestId('exercise-browser-loading')).toHaveCount(0);
    await page.getByLabel('Search exercises', { exact: true }).fill('Long triceps');
    await page.getByRole('button', { name: 'Long triceps & 2 variations', exact: true }).click();
    const row = page.getByRole('button', { name: `Open ${title}`, exact: true });
    await expect(row).toBeVisible();
    const geometry = await row.evaluate((element) => {
      const row = element.getBoundingClientRect();
      const text = [...element.querySelectorAll('*')].find(
        (node) =>
          node.textContent ===
          'Single-Arm Dumbbell Triceps Extension With A Very Long Exercise Name',
      )!;
      const icons = element.querySelectorAll('svg');
      const last = icons[icons.length - 1].getBoundingClientRect();
      return {
        right: row.right,
        textRight: text.getBoundingClientRect().right,
        iconLeft: last.left,
        iconRight: last.right,
        overflow: element.scrollWidth > element.clientWidth,
        whiteSpace: getComputedStyle(text).whiteSpace,
        fontSize: parseFloat(getComputedStyle(text).fontSize),
      };
    });
    expect(geometry.overflow).toBe(false);
    expect(geometry.iconRight).toBeLessThanOrEqual(geometry.right);
    expect(geometry.textRight).toBeLessThanOrEqual(geometry.iconLeft);
    expect(geometry.whiteSpace).not.toBe('nowrap');
    expect(geometry.fontSize).toBe(16);
    await page.screenshot({ path: info.outputPath(`long-exercise-${appearance}.png`) });
    await row.click();
    await expect(
      page
        .getByTestId('exercise-info-screen')
        .getByRole('button', { name: 'Back from exercise info', exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId('exercise-info-name')).toHaveText(title);
    const heading = page.getByTestId('exercise-info-name');
    await expect(heading).not.toHaveCSS('white-space', 'nowrap');
    await expect(heading).toHaveCSS('font-size', '23px');
    const headingGeometry = await heading.evaluate((node) => {
      const bounds = node.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(node);
      const text = range.getBoundingClientRect();
      return {
        lines: text.height / parseFloat(getComputedStyle(node).lineHeight),
        fits: node.scrollWidth <= node.clientWidth && text.height <= bounds.height + 1,
      };
    });
    expect(headingGeometry.lines).toBeGreaterThan(1);
    expect(headingGeometry.fits).toBe(true);
    await expect(page.getByRole('button', { name: 'Exercise options', exact: true })).toBeInViewport();
    await page.screenshot({ path: info.outputPath(`long-exercise-info-${appearance}.png`) });
    const rightSide = page.getByRole('button', { name: 'Lead with the right side', exact: true });
    await rightSide.scrollIntoViewIfNeeded();
    await rightSide.click();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem('@forge/settings-preferences')!).exerciseLeadSide?.[
              'custom-long-0'
            ],
        ),
      )
      .toBe('right');
    await page.getByTestId('exercise-info-content').evaluate((root) => {
      const scroller = [root, ...root.querySelectorAll('*')].find(
        (node) =>
          /auto|scroll/.test(getComputedStyle(node).overflowY) &&
          node.scrollHeight > node.clientHeight + 1,
      );
      if (scroller) scroller.scrollTop = scroller.scrollHeight;
    });
    await expect(page.getByText('Leading side', { exact: true }).locator('..')).toBeInViewport({
      ratio: 1,
    });
    // The shared side indicator takes 190ms to reach its selected position.
    await page.waitForTimeout(220);
    await page.screenshot({ path: info.outputPath(`long-exercise-settings-${appearance}.png`) });
    await page.getByRole('button', { name: 'Lead with the left side', exact: true }).click();
  });
}

for (const appearance of ['light', 'dark']) {
  test(`long exercise names wrap in live and recorded workouts (${appearance})`, async ({
    page,
  }, info) => {
    await page.addInitScript(
      ({ appearance, title }) => {
        localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance }));
        const workout = {
          id: 'long-title-live',
          name: 'Long name workout',
          type: 'Strength',
          startedAt: Date.now() - 120000,
          completedAt: null,
          exercises: [
            {
              id: 'long-name-exercise',
              name: title,
              trackingType: 'weight-reps',
              sets: [{ id: 'long-name-set', weight: '50', reps: '8', completed: false }],
            },
          ],
        };
        localStorage.setItem('@forge/active-workout', JSON.stringify(workout));
        localStorage.setItem(
          '@forge/completed-workouts',
          JSON.stringify([
            {
              ...workout,
              id: 'long-title-recorded',
              completedAt: Date.now(),
              exercises: workout.exercises.map((e) => ({
                ...e,
                sets: e.sets.map((s) => ({ ...s, completed: true })),
              })),
            },
          ]),
        );
      },
      { appearance, title },
    );
    await page.goto('/');
    const visibleName = () =>
      page.getByText(title, { exact: true }).filter({ visible: true }).first();
    await expect(visibleName()).toBeVisible();
    await expect(visibleName()).not.toHaveCSS('white-space', 'nowrap');
    await expect
      .poll(() => visibleName().evaluate((n) => parseFloat(getComputedStyle(n).fontSize)))
      .toBe(16);
    await page.screenshot({ path: info.outputPath(`long-name-live-${appearance}.png`) });
    await page.getByRole('tab', { name: 'History', exact: true }).click();
    await page.getByRole('button', { name: 'Open Long name workout', exact: true }).click();
    await expect(visibleName()).not.toHaveCSS('white-space', 'nowrap');
    await expect
      .poll(() => visibleName().evaluate((n) => parseFloat(getComputedStyle(n).fontSize)))
      .toBe(16);
    await page.screenshot({ path: info.outputPath(`long-name-recorded-${appearance}.png`) });
  });
}
