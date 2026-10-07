import { expect, test, type Locator } from '@playwright/test';

async function scrollToFraction(list: Locator, fraction: number) {
  await list.evaluate((element, value) => {
    element.scrollTop = (element.scrollHeight - element.clientHeight) * value;
  }, fraction);
}

for (const appearance of ['light', 'dark'] as const) {
  test(`bounds routine mounting in long standalone and plan groups (${appearance})`, async ({
    page,
  }, testInfo) => {
    await page.addInitScript((theme) => {
      const routine = (index: number, planId?: string) => ({
        id: `${planId ?? 'standalone'}-${index}`,
        name: `${planId ?? 'Standalone'} routine ${index}`,
        type: 'Strength',
        exercises: [],
        planId,
        createdAt: 1,
        updatedAt: 1,
      });
      localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance: theme }));
      localStorage.setItem(
        '@forge/plans-v1',
        JSON.stringify({
          standaloneRoutines: Array.from({ length: 300 }, (_, i) => routine(i)),
          plans: [
            {
              id: 'Long plan',
              name: 'Long plan',
              createdAt: 1,
              updatedAt: 1,
              routines: Array.from({ length: 300 }, (_, i) => routine(i, 'Long plan')),
            },
          ],
        }),
      );
    }, appearance);
    await page.goto('/');
    await page.getByRole('tab', { name: 'Plans' }).click();
    await expect(
      page.getByRole('button', { name: 'Routine actions for Standalone routine 0', exact: true }),
    ).toBeVisible();
    const mountedRows = page.getByRole('button', { name: /^Routine actions for / });
    await expect.poll(() => mountedRows.count()).toBeLessThan(100);
    await page.waitForTimeout(250);
    await page.screenshot({ path: testInfo.outputPath(`plans-standalone-${appearance}.png`) });
    const list = page.getByTestId('plans-scroll');
    await scrollToFraction(list, 0.6);
    await expect(page.getByText('Long plan routine 60', { exact: true })).toBeAttached();
    await expect.poll(() => mountedRows.count()).toBeLessThan(100);
    await page.waitForTimeout(250);
    await page.screenshot({ path: testInfo.outputPath(`plans-plan-${appearance}.png`) });
    await scrollToFraction(list, 1);
    await expect(
      page.getByRole('button', { name: 'Routine actions for Long plan routine 299', exact: true }),
    ).toBeVisible();
    await expect.poll(() => mountedRows.count()).toBeLessThan(100);
  });
}

test('retains a held routine from the middle of a virtualized group during long edge scrolling', async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem('@forge/settings-preferences', JSON.stringify({ appearance: 'dark' }));
    localStorage.setItem(
      '@forge/plans-v1',
      JSON.stringify({
        plans: [],
        standaloneRoutines: Array.from({ length: 300 }, (_, i) => ({
          id: `held-${i}`,
          name: `Held routine ${i}`,
          type: 'Strength',
          exercises: [],
          createdAt: 1,
          updatedAt: 1,
        })),
      }),
    );
  });
  await page.goto('/');
  await page.getByRole('tab', { name: 'Plans' }).click();
  await page.getByRole('button', { name: 'Edit plans' }).click();
  const list = page.getByTestId('plans-scroll');
  await scrollToFraction(list, 0.4);
  await page.waitForTimeout(250);
  const viewport = await list.boundingBox();
  if (!viewport) throw new Error('Missing plans viewport');
  const handles = page.getByRole('button', { name: /^Reorder Held routine/ });
  let heldIndex: number | undefined;
  let x = 0;
  let y = 0;
  await expect
    .poll(async () => {
      for (const handle of await handles.all()) {
        const box = await handle.boundingBox();
        if (!box || box.y < viewport.y + 80 || box.y > viewport.y + viewport.height / 2) continue;
        heldIndex = Number((await handle.getAttribute('aria-label'))?.match(/\d+$/)?.[0]);
        x = box.x + box.width / 2;
        y = box.y + box.height / 2;
        return true;
      }
      return false;
    })
    .toBe(true);
  if (heldIndex === undefined) throw new Error('Missing held routine');
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(180);
  await page.mouse.move(x, viewport.y + viewport.height - 24, { steps: 20 });
  const before = await list.evaluate((element) => element.scrollTop);
  await expect
    .poll(() => list.evaluate((element) => element.scrollTop), { timeout: 15000, intervals: [100] })
    .toBeGreaterThan(before + viewport.height * 3);
  await page.screenshot({ path: testInfo.outputPath('plans-held-middle-autoscroll.png') });
  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate(
        (id) =>
          JSON.parse(localStorage.getItem('@forge/plans-v1') ?? '{}').standaloneRoutines.findIndex(
            (routine: { id: string }) => routine.id === id,
          ),
        `held-${heldIndex}`,
      ),
    )
    .toBeGreaterThan(heldIndex + 10);
  await expect.poll(() => handles.count()).toBeLessThan(100);
  const ids = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('@forge/plans-v1') ?? '{}').standaloneRoutines.map(
      (routine: { id: string }) => routine.id,
    ),
  );
  expect(ids).toHaveLength(300);
  expect(new Set(ids).size).toBe(300);
});
