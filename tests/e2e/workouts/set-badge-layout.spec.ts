import { expect, test, type Locator } from '@playwright/test';
import type { Workout } from '../../../src/types';

async function expectSeparate(a: Locator, b: Locator) {
  const [first, second] = await Promise.all([a.boundingBox(), b.boundingBox()]);
  if (!first || !second) throw new Error('Expected visible set indicators');
  expect(
    first.x + first.width <= second.x ||
      second.x + second.width <= first.x ||
      first.y + first.height <= second.y ||
      second.y + second.height <= first.y,
  ).toBe(true);
}

for (const appearance of ['light', 'dark'] as const) {
  for (const mode of ['live', 'history'] as const) {
    test(`${appearance} ${mode} badges use equal sizes and separate corner dots`, async ({ page }, info) => {
      const workout: Workout = {
        id: 'badge-session',
        name: 'Badge review',
        type: 'Strength',
        note: '',
        startedAt: Date.now() - 120000,
        completedAt: mode === 'history' ? Date.now() : null,
        exercises: [
          {
            id: 'pull-up',
            name: 'Weighted Pull-Up',
            trackingType: 'weight-reps',
            sets: Array.from({ length: 10 }, (_, index) => ({
              id: `badge-set-${index}`,
              weight: '20',
              reps: '8',
              completed: true,
              ...(index === 0 || index === 1 || index === 9
                ? {
                    comment: 'Keep form',
                    targetWeight: '22',
                    tag: index === 1 ? 'Warm Up' : undefined,
                    measurements: [
                      {
                        id: `effort-${index}`,
                        kind: 'rpe' as const,
                        unit: 'rpe' as const,
                        value: index === 9 ? 10 : 9.5,
                      },
                    ],
                  }
                : {}),
            })),
          },
        ],
      };
      await page.addInitScript(
        ({ appearance, mode, workout }) => {
          localStorage.setItem(
            '@forge/settings-preferences',
            JSON.stringify({ appearance, showRestTimer: false }),
          );
          localStorage.setItem(
            '@forge/active-workout',
            mode === 'live' ? JSON.stringify(workout) : 'null',
          );
          localStorage.setItem(
            '@forge/completed-workouts',
            mode === 'history' ? JSON.stringify([workout]) : '[]',
          );
        },
        { appearance, mode, workout },
      );
      await page.goto('/');
      if (mode === 'history') {
        await page.getByRole('tab', { name: 'History' }).click();
        await page.getByRole('button', { name: 'Open Badge review', exact: true }).click();
        const expand = page.getByRole('button', { name: 'Expand Weighted Pull-Up', exact: true });
        const box = await expand.boundingBox();
        if (!box) throw new Error('Expected collapsed exercise row');
        await page.mouse.move(box.x + 30, box.y + box.height / 2);
        await page.mouse.down();
        await expect(expand.getByTestId('forge-press-state-layer')).toBeVisible();
        await page
          .getByTestId('history-exercise-pull-up')
          .screenshot({ path: info.outputPath(`${appearance}-exercise-row-pressed.png`) });
        await expect(expand.getByTestId('forge-press-state-layer')).toHaveCSS(
          'border-radius',
          '16px',
        );
        await page.mouse.up();
        await expect(page.getByTestId('history-set-number-chip-1')).toBeVisible();
      }
      for (const index of [1, 2, 10]) {
        const badgeId = `${mode === 'live' ? 'live' : 'history'}-set-number-chip-${index}`;
        const badge = page.getByTestId(badgeId);
        await badge.scrollIntoViewIfNeeded();
        await badge.evaluate((element) => element.scrollIntoView({ block: 'center' }));
        const number = page.getByTestId(`${badgeId}-number`);
        const [badgeBox, numberBox] = await Promise.all([badge.boundingBox(), number.boundingBox()]);
        if (!badgeBox || !numberBox) throw new Error('Expected measurable set badge');
        expect(Math.abs(numberBox.x + numberBox.width / 2 - badgeBox.x - badgeBox.width / 2)).toBeLessThanOrEqual(1);
        expect(Math.abs(numberBox.y + numberBox.height / 2 - badgeBox.y - badgeBox.height / 2)).toBeLessThanOrEqual(1);
        const effort = page.getByLabel(`Set ${index} RIR ${index === 10 ? 0 : 0.5}`, {
          exact: true,
        });
        const comment = page.getByLabel(`Set ${index} has a comment`, { exact: true });
        const target = page.getByLabel(`Set ${index} has a next session target`, { exact: true });
        await expect(badge).toHaveCSS('width', '36px');
        await expect(badge).toHaveCSS('height', '36px');
        const dotColor = await effort.evaluate(element => getComputedStyle(element).backgroundColor);
        await expect(comment).toHaveCSS('background-color', dotColor);
        await expect(target).toHaveCSS('background-color', dotColor);
        await expect(effort).toBeVisible();
        await expect(effort).toHaveText('');
        const dotBox = (await effort.boundingBox())!;
        expect(dotBox.width).toBe(dotBox.height);
        expect(await effort.evaluate(element => parseFloat(getComputedStyle(element).borderRadius))).toBeGreaterThanOrEqual(dotBox.width / 2);
        await expect(badge).not.toContainText('RIR');
        const plain = page.getByTestId(`${mode === 'live' ? 'live' : 'history'}-set-number-chip-3`);
        const plainBox = (await plain.boundingBox())!;
        expect(badgeBox.width).toBe(plainBox.width);
        expect(badgeBox.height).toBe(plainBox.height);
        const [effortBox, commentBox, targetBox] = await Promise.all([effort.boundingBox(), comment.boundingBox(), target.boundingBox()]);
        expect(effortBox!.y).toBe(commentBox!.y);
        expect(effortBox!.x).toBe(targetBox!.x);
        expect(targetBox!.y).toBeLessThan(effortBox!.y);
        expect(commentBox!.x).toBeGreaterThan(effortBox!.x);
        await expect(comment).toBeVisible();
        await expect(target).toBeVisible();
        for (const indicator of [effort, comment, target]) {
          const box = (await indicator.boundingBox())!;
          expect(box.x).toBeGreaterThanOrEqual(badgeBox.x);
          expect(box.y).toBeGreaterThanOrEqual(badgeBox.y);
          expect(box.x + box.width).toBeLessThanOrEqual(badgeBox.x + badgeBox.width);
          expect(box.y + box.height).toBeLessThanOrEqual(badgeBox.y + badgeBox.height);
        }
        for (const [a, b] of [
          [number, effort],
          [number, target],
          [number, comment],
          [effort, target],
          [comment, target],
          [effort, comment],
        ])
          await expectSeparate(a, b);
        await badge
          .locator('..')
          .locator('..')
          .screenshot({ path: info.outputPath(`${appearance}-${mode}-set-${index}.png`) });
      }
      await page.getByRole('button', { name: 'Open details for set 10', exact: true }).click();
      if (mode === 'live')
        await expect(page.getByLabel('Comment for set 10')).toHaveValue('Keep form');
      else
        await expect(
          page.getByRole('dialog').getByText('Keep form', { exact: true }),
        ).toBeVisible();
    });
  }
}
