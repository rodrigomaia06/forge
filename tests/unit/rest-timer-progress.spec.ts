import { expect, test } from '@playwright/test';
import { restTimerPhase, restTimerProgress } from '../../src/domain/rest/restTimerProgress';

for (const duration of [30, 90, 300, 600]) {
  test(`timer colour follows the remaining percentage of ${duration}s`, () => {
    expect(restTimerPhase(duration * 0.2 + 1, duration)).toBe('normal');
    expect(restTimerPhase(duration * 0.2, duration)).toBe('warning');
    expect(restTimerPhase(0, duration)).toBe('overdue');
    expect(restTimerPhase(-1, duration)).toBe('overdue');
    expect(restTimerProgress(duration / 2, duration)).toBe(0.5);
    expect(restTimerProgress(-10, duration)).toBe(0);
  });
}
