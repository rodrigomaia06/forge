import { expect, test } from '@playwright/test';

for (const appearance of ['light', 'dark']) {
  for (const unilateral of [false, true]) {
    test(`grouped exercise info ${unilateral ? 'unilateral' : 'ordinary'} (${appearance})`, async ({ page }, info) => {
      const name = unilateral ? 'Single-arm overhead cable triceps extension with rope attachment' : 'Dumbbell Shoulder Press';
      const equipment = unilateral ? 'Adjustable cable machine with a single rope attachment' : 'Dumbbell & Bench';
      await page.addInitScript(({ appearance, unilateral, name, equipment }) => {
        localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance }));
        localStorage.setItem('@forge/custom-exercises', JSON.stringify([{
          id: 'info-layout', name, group: 'Layout test', category: unilateral ? 'Triceps' : 'Shoulders',
          equipment, primaryEquipment: equipment, trackingType: 'weight-reps',
          workoutTypeIds: ['strength'], aliases: [], primaryMuscle: unilateral ? 'Triceps' : 'Front delts',
          secondaryMuscles: unilateral ? [] : ['Side delts', 'Triceps'],
          laterality: unilateral ? 'unilateral' : 'bilateral',
        }]));
      }, { appearance, unilateral, name, equipment });
      await page.goto('/');
      await page.getByRole('tab', { name: 'Settings', exact: true }).click();
      await page.getByRole('button', { name: 'Exercises', exact: true }).click();
      await page.getByRole('button', { name: /^All exercises, \d+ exercises$/ }).click();
      await expect(page.getByTestId('exercise-browser-loading')).toHaveCount(0);
      await page.getByLabel('Search exercises', { exact: true }).fill('Layout test');
      await page.getByRole('button', { name: 'Open Layout test', exact: true }).click();
      const screen = page.getByTestId('exercise-info-screen');
      await expect(screen.getByTestId('exercise-info-name')).toHaveText(name);
      await expect(screen.getByRole('heading', { name: 'Exercise essentials', exact: true })).toBeVisible();
      await expect(screen.getByRole('heading', { name: 'Muscle profile', exact: true })).toBeVisible();
      await expect(screen.getByText('Form Cue', { exact: true })).toHaveCount(0);
      const equipmentRow = screen.getByTestId('exercise-fact-equipment');
      await expect(equipmentRow).toContainText(equipment);
      for (const row of await screen.getByTestId(/^exercise-fact-/).all()) {
        const geometry = await row.evaluate(node => {
          const value = node.lastElementChild!;
          const label = node.firstElementChild!;
          const range = document.createRange();
          range.selectNodeContents(value);
          const text = range.getBoundingClientRect();
          const bounds = value.getBoundingClientRect();
          return {
            separated: label.getBoundingClientRect().right <= bounds.left,
            fits: value.scrollWidth <= value.clientWidth && text.height <= bounds.height + 1,
            overflow: node.scrollWidth > node.clientWidth,
          };
        });
        expect(geometry).toEqual({ separated: true, fits: true, overflow: false });
      }
      await page.screenshot({ path: info.outputPath(`info-${unilateral ? 'unilateral' : 'ordinary'}-${appearance}.png`) });
      if (unilateral) {
        await expect(screen.getByTestId('exercise-fact-secondary-muscles')).toHaveCount(0);
        const between = screen.getByRole('button', { name: 'Change between sides, currently Default', exact: true });
        await between.scrollIntoViewIfNeeded();
        await between.click();
        await page.getByTestId('exercise-rest-selection-list').getByRole('button', { name: 'Rest duration 01:40', exact: true }).click();
        await page.getByRole('button', { name: 'Close Between sides', exact: true }).click();
        await expect(screen.getByRole('button', { name: 'Change between sides, currently 1:40', exact: true })).toBeVisible();
        await screen.getByRole('button', { name: 'Lead with the right side', exact: true }).click();
        await expect.poll(() => page.evaluate(() =>
          JSON.parse(localStorage.getItem('@forge/settings-preferences')!).exerciseLeadSide?.['info-layout'],
        )).toBe('right');
        await page.screenshot({ path: info.outputPath(`info-unilateral-settings-${appearance}.png`) });
      } else {
        await expect(screen.getByText('Between sides', { exact: true })).toHaveCount(0);
        await expect(screen.getByText('Leading side', { exact: true })).toHaveCount(0);
        await screen.getByRole('button', { name: 'Change rest time, currently Default', exact: true }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: info.outputPath(`info-ordinary-settings-${appearance}.png`) });
      }
      await page.getByRole('radio', { name: 'Progress', exact: true }).click();
      await expect(page.getByRole('radio', { name: 'Progress', exact: true })).toHaveAttribute('aria-checked', 'true');
      await page.getByRole('radio', { name: 'History', exact: true }).click();
      await expect(page.getByRole('radio', { name: 'History', exact: true })).toHaveAttribute('aria-checked', 'true');
      await page.getByRole('radio', { name: 'Info', exact: true }).click();
      await expect(screen.getByTestId('exercise-info-name')).toHaveText(name);
      await page.getByRole('button', { name: 'Back from exercise info', exact: true }).click();
      await expect(page.getByLabel('Search exercises', { exact: true })).toHaveValue('Layout test');
      if (unilateral) {
        await page.getByRole('button', { name: 'Open Layout test', exact: true }).click();
        const between = screen.getByRole('button', { name: 'Change between sides, currently 1:40', exact: true });
        await between.scrollIntoViewIfNeeded();
        await between.click();
        await page.getByRole('button', { name: 'Use default', exact: true }).click();
        await page.getByRole('button', { name: 'Close Between sides', exact: true }).click();
        await expect(screen.getByRole('button', { name: 'Change between sides, currently Default', exact: true })).toBeVisible();
      }
    });
  }
}
