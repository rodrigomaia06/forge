import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

async function seed(page: Page, appearance: 'light' | 'dark') {
  await page.addInitScript((appearance) => {
    localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance }));
    const now = Date.now();
    const routine = {
      id: 'keyboard-routine',
      name: 'Keyboard routine',
      type: 'Strength',
      exercises: [],
      createdAt: now,
      updatedAt: now,
    };
    localStorage.setItem(
      '@forge/plans-v1',
      JSON.stringify({
        plans: [
          {
            id: 'keyboard-plan',
            name: 'Keyboard plan',
            routines: [],
            createdAt: now,
            updatedAt: now,
          },
        ],
        standaloneRoutines: [routine],
      }),
    );
    localStorage.setItem(
      '@forge/completed-workouts',
      JSON.stringify([
        {
          id: 'keyboard-history',
          name: 'Keyboard history',
          type: 'Strength',
          note: '',
          startedAt: now - 60000,
          completedAt: now,
          exercises: [],
        },
      ]),
    );
  }, appearance);
  await page.goto('/');
}

async function reducedViewport(page: Page) {
  await page.setViewportSize({ width: page.viewportSize()!.width, height: 360 });
}

async function expectTypingSettings(input: Locator) {
  await expect(input).toHaveAttribute('spellcheck', 'false');
  await expect(input).toHaveAttribute('autocomplete', 'off');
}

async function expectMatchingFade(page: Page) {
  const result = await page.getByTestId('forge-floating-cta-fade').evaluate(element => {
    const stop = element.querySelector('stop:last-child')!;
    const sample = document.createElement('div');
    sample.style.color = stop.getAttribute('stop-color')!;
    document.body.appendChild(sample);
    const color = getComputedStyle(sample).color;
    sample.remove();
    let parent = element.parentElement;
    while (parent && getComputedStyle(parent).backgroundColor === 'rgba(0, 0, 0, 0)') parent = parent.parentElement;
    return { color, surface: parent && getComputedStyle(parent).backgroundColor };
  });
  expect(result.color).toBe(result.surface);
}

async function captureVisible(page: Page, input: Locator, info: TestInfo, name: string) {
  await input.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const box = (await input.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await page.screenshot({ path: info.outputPath(`${name}-reduced-viewport.png`) });
}

for (const appearance of ['light', 'dark'] as const) {
  test(`${appearance} plan form scrolls within keyboard-sized space`, async ({ page }, info) => {
    await seed(page, appearance);
    await page.getByRole('tab', { name: 'Plans', exact: true }).click();
    await page.getByRole('button', { name: 'Options for Keyboard plan', exact: true }).click();
    await page
      .getByTestId('plans-plan-options-sheet')
      .getByRole('button', { name: 'Edit plan', exact: true })
      .click();
    await reducedViewport(page);
    const description = page.getByLabel('Plan description', { exact: true });
    await description.fill('A training block without unwanted corrections.');
    await expectTypingSettings(description);
    await captureVisible(page, description, info, 'plan-description');
    await page.getByRole('button', { name: 'Save plan', exact: true }).click();
    await expect(description).toHaveCount(0);
  });

  test(`${appearance} measurement forms fit keyboard-sized space and save`, async ({
    page,
  }, info) => {
    await seed(page, appearance);
    await page.getByRole('tab', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Measurements', exact: true }).click();
    await page.getByRole('button', { name: 'Add measure', exact: true }).last().click();
    await reducedViewport(page);
    const name = page.getByLabel('Measure name', { exact: true });
    const unit = page.getByLabel('Measure unit', { exact: true });
    await name.fill('Body weight');
    await unit.fill('kg');
    await expectTypingSettings(name);
    await expectTypingSettings(unit);
    await expectMatchingFade(page);
    await captureVisible(page, unit, info, 'measure-unit');
    await page.getByRole('button', { name: 'Add measure', exact: true }).last().click();
    await page.getByRole('button', { name: 'Record measurement', exact: true }).click();
    const value = page.getByLabel('Body weight value', { exact: true });
    await value.fill('81.4');
    await expectTypingSettings(value);
    await expectMatchingFade(page);
    const unitLabel = page.getByText('kg', { exact: true }).last();
    const unitBox = (await unitLabel.boundingBox())!;
    expect(unitBox.x + unitBox.width).toBeLessThanOrEqual(page.viewportSize()!.width - 20);
    await captureVisible(page, value, info, 'measurement-value');
    const save = page.getByRole('button', { name: 'Save measurement', exact: true });
    await captureVisible(page, save, info, 'measurement-save');
    await save.click();
    await expect(value).toHaveCount(0);
  });

  for (const mode of ['routine', 'history'] as const) {
    test(`${appearance} ${mode} attribute editor scrolls without an outer gap`, async ({
      page,
    }, info) => {
      await seed(page, appearance);
      if (mode === 'routine') {
        await page.getByRole('tab', { name: 'Plans', exact: true }).click();
        await page
          .getByRole('button', { name: 'Routine actions for Keyboard routine', exact: true })
          .click();
        await page.getByRole('button', { name: 'Edit', exact: true }).click();
      } else {
        await page.getByRole('tab', { name: 'History', exact: true }).click();
        await page.getByRole('button', { name: 'Open Keyboard history', exact: true }).click();
        await page.getByRole('button', { name: 'Workout options', exact: true }).click();
        await page.getByRole('button', { name: 'Edit workout', exact: true }).click();
      }
      await page.getByRole('button', { name: 'Add attribute', exact: true }).click();
      await reducedViewport(page);
      const label = page.getByLabel('Attribute label', { exact: true });
      const value = page.getByLabel('Attribute value', { exact: true });
      await label.fill('Location');
      await value.fill('Forge gym');
      await expectTypingSettings(label);
      await expectTypingSettings(value);
      await captureVisible(page, value, info, `${mode}-attribute-value`);
      const save = page.getByRole('button', { name: 'Save attribute', exact: true });
      await captureVisible(page, save, info, `${mode}-attribute-save`);
      await save.click();
      await expect(value).toHaveCount(0);
    });
  }
}
