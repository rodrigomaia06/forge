import { expect, test, type Page } from '@playwright/test';
import { defaultSettingsPreferences } from '../../../src/data/settingsDefaults';

async function seed(page: Page, appearance: 'light' | 'dark') {
  const now = Date.now();
  await page.addInitScript(
    ({ preferences, now }) => {
      if (sessionStorage.getItem('types-seeded')) return;
      sessionStorage.setItem('types-seeded', 'yes');
      localStorage.setItem('@forge/settings-preferences', JSON.stringify(preferences));
      localStorage.setItem(
        '@forge/dashboard-layout-v1',
        JSON.stringify([{ id: 'calendar', kind: 'calendar', visible: true }]),
      );
      localStorage.setItem(
        '@forge/completed-workouts',
        JSON.stringify([
          {
            id: 'saved-strength',
            name: 'Saved strength',
            type: 'Strength',
            startedAt: now - 600000,
            completedAt: now,
            note: '',
            exercises: [],
          },
        ]),
      );
    },
    {
      preferences: {
        ...defaultSettingsPreferences,
        appearance,
        workoutTypes: [
          ...defaultSettingsPreferences.workoutTypes,
          { id: 'custom', name: 'Recovery', source: 'custom', color: '#123456' },
          { id: 'hidden', name: 'Hidden custom', source: 'custom', color: '#987654', hidden: true },
        ],
      },
      now,
    },
  );
  await page.goto('/');
  await page.getByRole('tab', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Workout types', exact: true }).click();
}
async function stored(page: Page) {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem('@forge/settings-preferences') ?? '{}').workoutTypes.find(
      (type: { id: string }) => type.id === 'strength',
    ),
  );
}

for (const appearance of ['light', 'dark'] as const) {
  test(`${appearance} built-in colors update saved presentation, persist and reset`, async ({
    page,
  }, info) => {
    await seed(page, appearance);
    for (const label of ['Included', 'Custom', 'Hidden'])
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    await page.screenshot({ path: info.outputPath('types-list.png') });
    await page
      .getByRole('button', { name: 'Hidden custom workout type', exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath('custom-hidden-types.png') });
    await page.getByRole('button', { name: 'Strength workout type', exact: true }).click();
    await expect(page.getByLabel('Workout type name')).toHaveCount(0);
    await expect(
      page.getByRole('switch', { name: 'Show Strength in workout pickers' }),
    ).toBeVisible();
    await page.screenshot({ path: info.outputPath('included-type-editor.png') });
    const nameRow = await page.getByTestId('workout-type-name-row').boundingBox();
    const nameText = await page.getByTestId('workout-type-readonly-name').boundingBox();
    expect(
      Math.abs(nameRow!.y + nameRow!.height / 2 - nameText!.y - nameText!.height / 2),
    ).toBeLessThan(1);
    await page.getByRole('button', { name: 'Workout type color', exact: true }).click();
    await expect(page.getByTestId('custom-workout-type-color-picker')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Use default workout type color' }),
    ).toBeVisible();
    await page.waitForTimeout(550);
    await page.screenshot({ path: info.outputPath('direct-color-picker-default.png') });
    await expect(page.getByRole('button', { name: 'Named colors', exact: true })).toHaveCount(0);
    await expect(
      page.getByRole('radiogroup', { name: 'Preset colors' }).getByRole('radio'),
    ).toHaveCount(6);
    await page.getByRole('radio', { name: 'Use Red color' }).click();
    await expect(page.getByRole('radio', { name: 'Use Red color' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(
      page.getByRole('button', { name: 'Apply color #F27D7D', exact: true }),
    ).toBeVisible();
    expect((await stored(page)).color).toBe('#7C8CF8');
    await page.waitForTimeout(150);
    await page.screenshot({ path: info.outputPath('selected-preset-color.png') });
    await page.getByRole('button', { name: 'Apply color #F27D7D', exact: true }).click();
    await expect(page.getByTestId('workout-type-color-picker')).toHaveCount(0);
    await expect
      .poll(() => stored(page))
      .toMatchObject({ color: '#F27D7D', colorCustomized: true });
    await page.getByRole('button', { name: 'Back to Workout types' }).click();
    await expect(page.getByTestId('workout-type-icon-strength').and(page.locator('svg'))).toHaveCSS(
      'stroke',
      'rgb(242, 125, 125)',
    );
    await page.getByRole('button', { name: 'Back to Settings' }).click();
    await page.getByRole('tab', { name: 'History' }).click();
    await expect(page.getByTestId('history-type-icon-saved-strength')).toHaveCSS(
      'background-color',
      'rgba(242, 125, 125, 0.14)',
    );
    await page.getByRole('tab', { name: 'Dashboard' }).click();
    await page.getByRole('button', { name: 'Open calendar', exact: true }).click();
    const day = page.getByRole('button', { name: /Saved strength/ });
    await expect(day).toBeVisible();
    expect(
      await day
        .locator('div')
        .evaluateAll((nodes) =>
          nodes.some((node) => getComputedStyle(node).backgroundColor === 'rgb(242, 125, 125)'),
        ),
    ).toBe(true);
    await page.goto('/');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Workout types', exact: true }).click();
    await expect(page.getByTestId('workout-type-icon-strength').and(page.locator('svg'))).toHaveCSS(
      'stroke',
      'rgb(242, 125, 125)',
    );
    await page.getByRole('button', { name: 'Strength workout type', exact: true }).click();
    await page.getByRole('button', { name: 'Workout type color', exact: true }).click();
    await page.getByRole('button', { name: 'Use default workout type color' }).click();
    await expect
      .poll(() => stored(page))
      .toMatchObject({ color: '#7C8CF8', colorCustomized: false });
    await page.goto('/');
    expect((await stored(page)).color).toBe('#7C8CF8');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Workout types', exact: true }).click();
    await page
      .getByRole('button', { name: 'Olympic weightlifting workout type', exact: true })
      .click();
    await expect(page.getByTestId('workout-type-readonly-name')).toHaveText(
      'Olympic weightlifting',
    );
    const longRow = await page.getByTestId('workout-type-name-row').boundingBox();
    const longText = await page.getByTestId('workout-type-readonly-name').boundingBox();
    expect(
      Math.abs(longRow!.y + longRow!.height / 2 - longText!.y - longText!.height / 2),
    ).toBeLessThan(1);
    await page.screenshot({ path: info.outputPath('olympic-type-editor.png') });
  });

  test(`${appearance} custom picker previews, applies, cancels and restores included types`, async ({
    page,
  }, info) => {
    await seed(page, appearance);
    await page.getByRole('button', { name: 'Strength workout type', exact: true }).click();
    await page.getByRole('button', { name: 'Workout type color', exact: true }).click();
    await page.waitForTimeout(550);
    await expect(page.getByTestId('custom-color-scroll')).toHaveCSS('overflow-y', 'hidden');
    await page.screenshot({ path: info.outputPath('custom-color-palette.png') });
    await expect(page.getByRole('radio', { name: 'Use Blue color' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.getByRole('radio', { name: 'Use Green color' }).click();
    await expect(
      page.getByRole('button', { name: 'Apply color #6BD48F', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Use Green color' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect.poll(() => stored(page)).toMatchObject({ color: '#7C8CF8' });
    await expect(
      page.getByRole('button', { name: 'Use default workout type color' }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Close workout type color', exact: true })
      .last()
      .click();
    await page.getByRole('button', { name: 'Workout type color', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Apply color #7C8CF8', exact: true }),
    ).toBeVisible();
    const panel = page.getByLabel('Color saturation and brightness');
    const hue = page.getByLabel('Color hue');
    await hue.click({ position: { x: 95, y: 20 } });
    const bounds = (await panel.boundingBox())!;
    await page.mouse.move(bounds.x + bounds.width * 0.4, bounds.y + bounds.height * 0.65);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * 0.75, bounds.y + bounds.height * 0.25, {
      steps: 8,
    });
    await page.mouse.up();
    const apply = page.getByRole('button', { name: /^Apply color #/ });
    await expect(apply).not.toHaveAttribute('aria-label', 'Apply color #7C8CF8');
    await expect.poll(() => stored(page)).toMatchObject({ color: '#7C8CF8' });
    expect((await stored(page)).colorCustomized).not.toBe(true);
    await page.screenshot({ path: info.outputPath('custom-color-preview.png') });
    await page.getByRole('radio', { name: 'Use Blue color' }).click();
    await expect(apply).toHaveAttribute('aria-label', 'Apply color #7C8CF8');
    await page.getByRole('radio', { name: 'Use Red color' }).click();
    await page.getByRole('radio', { name: 'Use Blue color' }).click();
    await expect(apply).toHaveAttribute('aria-label', 'Apply color #7C8CF8');
    await page
      .getByRole('button', { name: 'Close workout type color', exact: true })
      .last()
      .click();
    await expect.poll(() => stored(page)).toMatchObject({ color: '#7C8CF8' });
    await page.getByRole('button', { name: 'Workout type color', exact: true }).click();
    await expect(apply).toHaveAttribute('aria-label', 'Apply color #7C8CF8');
    await panel.click({ position: { x: 95, y: 100 } });
    await expect(apply).not.toHaveAttribute('aria-label', 'Apply color #7C8CF8');
    const color = (await apply.getAttribute('aria-label'))!.split(' ').at(-1)!;
    expect(color).toMatch(/^#[0-9A-F]{6}$/);
    await apply.click();
    await expect(page.getByTestId('workout-type-color-picker')).toHaveCount(0);
    await expect.poll(() => stored(page)).toMatchObject({ color, colorCustomized: true });
    await page.getByRole('button', { name: 'Workout type color', exact: true }).click();
    await expect(apply).toHaveAttribute('aria-label', `Apply color ${color}`);
    await page.waitForTimeout(550);
    await page.screenshot({ path: info.outputPath('selected-custom-color.png') });
    await hue.focus();
    await hue.press('ArrowRight');
    await expect(apply).not.toHaveAttribute('aria-label', `Apply color ${color}`);
    await page
      .getByRole('button', { name: 'Close workout type color', exact: true })
      .last()
      .click();
    await expect.poll(() => stored(page)).toMatchObject({ color });
    await page.getByRole('switch', { name: 'Show Strength in workout pickers' }).click();
    await page.getByRole('button', { name: 'Back to Workout types' }).click();
    await expect(
      page.getByRole('button', { name: 'Strength workout type', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Strength workout type', exact: true }).click();
    await page.getByRole('switch', { name: 'Show Strength in workout pickers' }).click();
    await expect.poll(() => stored(page)).toMatchObject({ hidden: false, color });
    await page.getByRole('button', { name: 'Back to Workout types' }).click();
    await page.getByRole('button', { name: 'Recovery workout type', exact: true }).click();
    await expect(page.getByLabel('Workout type name')).toHaveValue('Recovery');
    await page.screenshot({ path: info.outputPath('custom-type-editor.png') });
    await page.getByRole('button', { name: 'Workout type color', exact: true }).click();
    await expect(page.getByTestId('custom-workout-type-color-picker')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Use default workout type color' })).toHaveCount(
      0,
    );
  });
}
