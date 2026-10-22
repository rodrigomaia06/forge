import { expect, test } from '@playwright/test';

for (const appearance of ['light', 'dark']) {
  test(`attribute groups retain their surface and visible separators (${appearance})`, async ({ page }, info) => {
    await page.addInitScript(appearance => {
      localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance }));
      localStorage.setItem('@forge/completed-workouts', JSON.stringify([{
        id: 'attribute-boundaries', name: 'Boundary check', type: 'Strength',
        startedAt: Date.now() - 3600000, completedAt: Date.now(), durationSeconds: 3600,
        note: '', exercises: [], attributes: { Location: '', Mood: 'Good' },
        attributeIcons: { Location: 'location', Mood: 'mood' },
      }]));
    }, appearance);
    await page.goto('/');
    await page.getByRole('tab', { name: 'History', exact: true }).click();
    await page.getByRole('button', { name: 'Open Boundary check', exact: true }).click();
    await page.getByRole('button', { name: 'Workout options', exact: true }).click();
    await page.getByRole('button', { name: 'Edit workout', exact: true }).click();
    const location = page.getByRole('button', { name: 'Edit Location attribute', exact: true });
    const mood = page.getByRole('button', { name: 'Edit Mood attribute', exact: true });
    const add = page.getByRole('button', { name: 'Add attribute', exact: true });
    await add.scrollIntoViewIfNeeded();
    await expect(mood).toHaveCSS('border-top-width', '1px');
    await expect(add).toHaveCSS('border-top-width', '1px');
    const group = add.locator('..');
    const groupFill = await group.evaluate(node => getComputedStyle(node).backgroundColor);
    await expect(location.locator('..')).toHaveCSS('background-color', groupFill);
    expect(await group.locator('..').evaluate(node => getComputedStyle(node).backgroundColor)).not.toBe(groupFill);
    await expect(add).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    expect(await mood.evaluate(node => getComputedStyle(node).borderTopColor)).not.toBe(groupFill);
    await page.waitForTimeout(300);
    await group.screenshot({ path: info.outputPath(`attribute-group-${appearance}.png`) });
    await page.getByLabel('Workout name', { exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByLabel('Workout name', { exact: true })).toHaveCSS('border-top-width', '1px');
    await page.screenshot({ path: info.outputPath(`editor-fields-${appearance}.png`) });
    await location.click();
    await expect(page.getByLabel('Attribute label', { exact: true })).toHaveValue('Location');
    await page.getByRole('button', { name: 'Save attribute', exact: true }).click();
    await expect(location).toBeVisible();
  });
}
