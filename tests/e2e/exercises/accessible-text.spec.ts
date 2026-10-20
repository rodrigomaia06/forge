import { expect, test } from '@playwright/test';

for (const appearance of ['light', 'dark']) {
  test(`200% text reflows set entry and preserves names (${appearance})`, async ({ page }, info) => {
    const name = '肩のプレス 💪 تمرين ' + 'UnbrokenExerciseName'.repeat(5);
    await page.addInitScript(({ appearance, name }) => {
      localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance }));
      localStorage.setItem('@forge/active-workout', JSON.stringify({
        id: 'accessible-live', name: 'Accessible workout', type: 'Strength', startedAt: Date.now(), completedAt: null,
        exercises: [{ id: 'accessible-exercise', name, trackingType: 'weight-reps', sets: [
          { id: 'accessible-set', weight: '50', reps: '8', completed: false },
        ] }],
      }));
      const recorded = JSON.parse(localStorage.getItem('@forge/active-workout')!);
      recorded.id = 'accessible-recorded';
      recorded.name = 'Recorded accessible workout';
      recorded.completedAt = Date.now();
      recorded.exercises[0].sets[0].completed = true;
      localStorage.setItem('@forge/completed-workouts', JSON.stringify([recorded]));
    }, { appearance, name });
    await page.goto('/');
    const weight = page.getByLabel('Kg for set 1', { exact: true });
    await expect(weight).toBeVisible();
    // Text-only enlargement exercises layout; native OS categories need device verification.
    await page.evaluate(() => {
      const enlarged = new WeakSet<HTMLElement>();
      const enlarge = () => {
        const nodes = [...document.querySelectorAll<HTMLElement>('[dir="auto"],input,textarea')].filter(node => !enlarged.has(node));
        const sizes = nodes.map(node => ({ node, font: parseFloat(getComputedStyle(node).fontSize), line: parseFloat(getComputedStyle(node).lineHeight) }));
        for (const { node, font, line } of sizes) {
          enlarged.add(node);
          node.style.fontSize = `${font * 2}px`;
          if (Number.isFinite(line)) node.style.lineHeight = `${line * 2}px`;
        }
      };
      enlarge();
      new MutationObserver(enlarge).observe(document.body, { childList: true, subtree: true });
    });
    await expect(weight).toHaveCSS('font-size', '30px');
    await expect(page.getByTestId('set-row-1').getByText('Kg', { exact: true })).toBeVisible();
    const reps = page.getByLabel('Reps for set 1', { exact: true });
    await weight.fill('75');
    await reps.fill('12');
    await page.getByRole('checkbox', { name: 'Complete set 1', exact: true }).click();
    await expect(page.getByRole('checkbox', { name: 'Set 1 completed', exact: true })).toBeVisible();
    const entity = page.getByText(name, { exact: true }).filter({ visible: true }).first();
    await expect(entity).toHaveText(name);
    expect(await entity.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    await weight.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`set-entry-200-${appearance}.png`) });
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('@forge/active-workout')!).exercises[0].sets[0].reps)).toBe('12');
    await page.getByRole('tab', { name: 'History', exact: true }).click();
    await page.getByRole('button', { name: 'Open Recorded accessible workout', exact: true }).click();
    await page.getByRole('button', { name: `Expand ${name}`, exact: true }).click();
    const recordedRow = page.getByTestId('workout-details-set-accessible-set');
    await recordedRow.scrollIntoViewIfNeeded();
    await expect(recordedRow.getByText('Kg', { exact: true })).toBeVisible();
    expect(await recordedRow.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: info.outputPath(`recorded-200-${appearance}.png`) });
  });
}

for (const appearance of ['light', 'dark']) {
  test(`very tall detail names move beneath reachable controls (${appearance})`, async ({ page }, info) => {
    const name = ('Long exercise name 肩 💪 تمرين ' + 'Unbroken'.repeat(8) + ' ').repeat(8);
    await page.addInitScript(({ appearance, name }) => {
      localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance }));
      localStorage.setItem('@forge/custom-exercises', JSON.stringify([{
        id: 'tall-name', name, group: 'Tall title test', category: 'Shoulders', equipment: 'Dumbbell',
        primaryEquipment: 'Dumbbell', trackingType: 'weight-reps', workoutTypeIds: ['strength'], aliases: [],
        primaryMuscle: 'Shoulders', secondaryMuscles: [], laterality: 'bilateral',
      }]));
    }, { appearance, name });
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Exercises', exact: true }).click();
    await page.getByRole('button', { name: /^All exercises, \d+ exercises$/ }).click();
    await expect(page.getByTestId('exercise-browser-loading')).toHaveCount(0);
    await page.getByLabel('Search exercises', { exact: true }).fill('Tall title test');
    await page.getByRole('button', { name: 'Open Tall title test', exact: true }).click();
    const title = page.getByTestId('exercise-info-name');
    await expect(title).toHaveCount(1);
    await expect(title).toHaveText(name);
    await expect(page.getByTestId('exercise-info-content').getByTestId('exercise-info-name')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Back from exercise info', exact: true })).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Exercise options', exact: true })).toBeInViewport();
    await page.screenshot({ path: info.outputPath(`tall-name-${appearance}.png`) });
    for (const tab of ['Progress', 'History', 'Info']) {
      await page.getByRole('radio', { name: tab, exact: true }).click();
      await expect(title).toHaveCount(1);
      await expect(title).toHaveText(name);
    }
    await page.getByRole('button', { name: 'Back from exercise info', exact: true }).click();
    await expect(page.getByLabel('Search exercises', { exact: true })).toHaveValue('Tall title test');
  });
}

for (const appearance of ['light', 'dark']) {
  test(`plan names wrap without separate disclosure controls (${appearance})`, async ({ page }, info) => {
    const name = 'Training plan 💪 ' + 'A long unbroken name 的訓練 خطة '.repeat(6);
    await page.addInitScript(({ appearance, name }) => {
      localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance }));
      localStorage.setItem('@forge/plans-v1', JSON.stringify({ plans: [{
        id: 'disclosure-plan', name, createdAt: 1, updatedAt: 1, routines: [],
      }], standaloneRoutines: [] }));
    }, { appearance, name });
    await page.goto('/');
    await page.getByRole('tab', { name: 'Plans', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Show full name', exact: true })).toHaveCount(0);
    const title = page.getByText(name, { exact: true });
    await expect(title).toBeVisible();
    const size = await title.evaluate(element => ({ height: element.clientHeight, content: element.scrollHeight }));
    expect(size.height + 1).toBeGreaterThanOrEqual(size.content);
    await page.waitForTimeout(220);
    await page.screenshot({ path: info.outputPath(`wrapped-plan-name-${appearance}.png`) });
  });
}

test('selection reveals distinct suffixes and preserves exercise identity', async ({ page }, info) => {
  const prefix = 'Single arm shoulder press with an extremely long identical prefix ';
  const names = [`${prefix}(Dumbbell)`, `${prefix}(Cable)`];
  await page.addInitScript(names => {
    localStorage.setItem('@forge/active-workout', JSON.stringify({ id: 'select-test', name: 'Selection', type: 'Strength', startedAt: Date.now(), completedAt: null, exercises: [] }));
    localStorage.setItem('@forge/custom-exercises', JSON.stringify(names.map((name, index) => ({
      id: `suffix-${index}`, name, group: 'Distinct suffix test', variation: name, category: 'Shoulders',
      equipment: index ? 'Cable' : 'Dumbbell', primaryEquipment: index ? 'Cable' : 'Dumbbell', trackingType: 'weight-reps',
      workoutTypeIds: ['strength'], aliases: [], primaryMuscle: 'Shoulders', secondaryMuscles: [], laterality: 'bilateral',
    }))));
  }, names);
  await page.goto('/');
  await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
  await page.getByRole('button', { name: 'Filters, 1 active', exact: true }).click();
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await page.getByLabel('Search exercises', { exact: true }).fill('Single arm shoulder press');
  await page.getByRole('button', { name: 'Distinct suffix test & 2 variations', exact: true }).click();
  for (const name of names) {
    const label = page.getByText(name, { exact: true }).filter({ visible: true }).first();
    await expect(label).toBeVisible();
    expect(await label.evaluate(node => {
      const range = document.createRange(); range.selectNodeContents(node);
      return range.getBoundingClientRect().height <= node.getBoundingClientRect().height + 1;
    })).toBe(true);
  }
  await page.screenshot({ path: info.outputPath('distinct-selection-suffixes.png') });
  await page.getByRole('checkbox').filter({ hasText: names[1] }).click();
  await page.getByRole('button', { name: 'Confirm selected exercises', exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('@forge/active-workout')!).exercises[0]?.name)).toBe(names[1]);
});
