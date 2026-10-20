import { expect, test } from '@playwright/test';

for (const appearance of ['light', 'dark']) {
  test(`routine visualization has options and joined headers share one surface (${appearance})`, async ({ page }, info) => {
    await page.addInitScript(appearance => {
      localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance }));
      localStorage.setItem('@forge/plans-v1', JSON.stringify({ plans: [{ id: 'view-plan', name: 'Push', createdAt: 1, updatedAt: 1, routines: [] }], standaloneRoutines: [{
        id: 'header-routine', name: 'Header routine', type: 'Strength', createdAt: 1, updatedAt: 1, exercises: [
          { id: 'preview-bench', exerciseId: 'barbell-bench-press', name: 'Barbell Bench Press', trackingType: 'weight-reps', note: 'Pause at the chest', sets: [{ id: 'preview-set', weight: '60', reps: '8' }] },
          { id: 'preview-squat', exerciseId: 'barbell-squat', name: 'Barbell Squat', trackingType: 'weight-reps', sets: [{ id: 'preview-squat-set', weight: '80', reps: '6' }] },
        ],
      }] }));
    }, appearance);
    await page.goto('/');
    const group = page.getByTestId('dashboard-header-actions');
    await expect(group).toBeVisible();
    await expect(group.locator('[style*="backdrop-filter"]')).toHaveCount(1);
    const buttons = group.getByRole('button');
    expect(await buttons.evaluateAll(nodes => nodes.map(node => getComputedStyle(node).backgroundColor))).toEqual(['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)']);
    await expect.poll(() => group.evaluate(node => {
      for (let parent: Element | null = node; parent; parent = parent.parentElement) {
        if (Number(getComputedStyle(parent).opacity) < 0.99) return false;
      }
      return true;
    })).toBe(true);
    const segment = buttons.first();
    await segment.hover();
    await page.mouse.down();
    const segmentBox = (await segment.boundingBox())!;
    const tintBox = (await segment.getByTestId('forge-press-state-layer').boundingBox())!;
    expect(tintBox.width).toBe(segmentBox.width);
    expect(tintBox.height).toBe(segmentBox.height);
    await group.screenshot({ path: info.outputPath(`joined-header-pressed-${appearance}.png`) });
    await page.mouse.move(0, 0);
    await page.mouse.up();
    await group.screenshot({ path: info.outputPath(`joined-header-${appearance}.png`) });
    await page.getByRole('tab', { name: 'Plans', exact: true }).click();
    await page.waitForTimeout(300);
    await expect(page.getByRole('button', { name: 'Show full name', exact: true })).toHaveCount(0);
    const planTrigger = page.getByTestId('plan-options-view-plan');
    await expect(planTrigger).toHaveCSS('width', '44px');
    await expect(planTrigger).toHaveCSS('height', '44px');
    const triggerBounds = (await planTrigger.boundingBox())!;
    await page.mouse.move(triggerBounds.x + 22, triggerBounds.y + 22);
    await page.mouse.down();
    await expect(planTrigger.getByTestId('forge-press-state-layer')).toHaveCSS('width', '40px');
    await expect(planTrigger.getByTestId('forge-press-state-layer')).toHaveCSS('height', '40px');
    await page.screenshot({ path: info.outputPath(`plan-options-pressed-${appearance}.png`) });
    await page.mouse.up();
    const planMenu = page.getByTestId('plans-plan-options-sheet');
    await expect(planMenu.getByText('Push', { exact: true })).toHaveCount(0);
    await page.waitForTimeout(300);
    await page.screenshot({ path: info.outputPath(`plan-options-${appearance}.png`) });
    await page.getByRole('button', { name: 'Close Plan options', exact: true }).click();
    await page.getByRole('button', { name: 'Routine actions for Header routine', exact: true }).click();
    const routineMenu = page.getByTestId('plans-options-sheet');
    await expect(routineMenu.getByText('Header routine', { exact: true })).toHaveCount(0);
    await page.waitForTimeout(300);
    await page.screenshot({ path: info.outputPath(`routine-options-${appearance}.png`) });
    await page.getByRole('button', { name: 'Visualize', exact: true }).click();
    const options = page.getByRole('button', { name: 'Routine options', exact: true });
    await expect(options).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit routine', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Expand Barbell Bench Press', exact: true }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: info.outputPath(`routine-view-${appearance}.png`) });
    const before = await page.evaluate(() => localStorage.getItem('@forge/plans-v1'));
    await page.getByRole('button', { name: 'More options for Barbell Bench Press', exact: true }).click();
    for (const name of ['View note', 'Previous sessions', 'Exercise info']) {
      await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
    }
    await expect(page.getByTestId('action-section-Log & setup')).toHaveCount(0);
    await expect(page.getByTestId('action-section-Review')).toHaveCount(0);
    for (const name of ['Tracking', 'Add note', 'Warm-up sets', 'Replace exercise', 'Remove Barbell Bench Press']) {
      await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
    }
    await page.waitForTimeout(300);
    await page.screenshot({ path: info.outputPath(`routine-exercise-options-${appearance}.png`) });
    await page.getByRole('button', { name: 'View note', exact: true }).click();
    await expect(page.getByText('Pause at the chest', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Back to exercise options', exact: true }).click();
    await page.getByRole('button', { name: 'Previous sessions', exact: true }).click();
    await expect(page.getByText('No completed sessions for this exercise yet.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Back from exercise info', exact: true }).click();
    await page.getByRole('button', { name: 'More options for Barbell Bench Press', exact: true }).click();
    await page.getByRole('button', { name: 'Exercise info', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Exercise essentials', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Back from exercise info', exact: true }).click();
    await page.getByRole('button', { name: 'More options for Barbell Back Squat', exact: true }).click();
    await expect(page.getByRole('button', { name: 'View note', exact: true })).toHaveCount(0);
    await expect(page.getByTestId('action-section-Log & setup')).toHaveCount(0);
    await page.getByRole('button', { name: 'Close Exercise options', exact: true }).click();
    expect(await page.evaluate(() => localStorage.getItem('@forge/plans-v1'))).toBe(before);
    await options.click();
    const sheet = page.getByTestId('routine-options-sheet');
    await expect(sheet.getByRole('button', { name: 'Share routine', exact: true })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Delete routine', exact: true })).toBeVisible();
    await sheet.getByRole('button', { name: 'Edit routine', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Save routine', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add exercises to routine', exact: true })).toBeVisible();
  });
}
