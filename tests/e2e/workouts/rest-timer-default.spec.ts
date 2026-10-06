import { expect, test } from '@playwright/test';
import { startBlankWorkout } from '../support/workoutFlow';

test('timer uses percentages and holding rest resets to the default', async ({ page }, testInfo) => {
  await page.clock.install({ time: new Date('2026-10-06T12:00:00Z') });
  await startBlankWorkout(page);
  await page.getByRole('button', { name: 'Start rest timer' }).click();
  await page.getByRole('button', { name: 'Start rest timer', exact: true }).last().click();
  // 90s default extended to 100s; warning begins at 20s, rather than a fixed time.
  await page.getByRole('button', { name: 'Increase rest by 10 seconds' }).click();
  await page.clock.fastForward(79_000);
  await expect(page.getByTestId('rest-timer-value')).not.toHaveCSS('color', 'rgb(197, 138, 69)');
  await page.clock.fastForward(1_000);
  await expect(page.getByTestId('rest-timer-value')).toHaveCSS('color', 'rgb(197, 138, 69)');
  await page.screenshot({ path: testInfo.outputPath('timer-20-percent-warning.png') });
  await page.getByRole('button', { name: 'Close rest timer' }).last().click();
  const header = page.getByRole('button', { name: /Rest timer,.*seconds remaining/ });
  const box = await header.boundingBox();
  if (!box) throw new Error('Rest header is missing');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.clock.runFor(500);
  await page.mouse.up();
  await expect(header).toHaveAccessibleName(/Rest timer, 90 seconds remaining/);
  await header.click();
  await expect(page.getByTestId('rest-timer-value')).toHaveText('01:30');
  await page.clock.runFor(350);
  await page.screenshot({ path: testInfo.outputPath('timer-hold-default.png') });
});
