export interface RestTimerAdjustment {
  duration: number;
  endAt: number | null;
}

/**
 * Applies a rest-timer adjustment from timestamp state.
 *
 * An elapsed timer restarts from its programmed duration when extended: this
 * keeps a finished 10-second rest plus 10 seconds at 20 seconds instead of
 * accidentally carrying overdue time into the next rest.
 */
export function adjustRestTimer({
  duration,
  endAt,
  seconds,
  now,
}: RestTimerAdjustment & { seconds: number; now: number }): RestTimerAdjustment {
  const safeDuration = Math.max(0, Math.round(duration));
  const currentRemaining = endAt ? Math.max(0, Math.ceil((endAt - now) / 1000)) : 0;
  const restartingExpiredTimer = Boolean(endAt && endAt <= now && seconds > 0);
  const nextRemaining = restartingExpiredTimer
    ? Math.max(1, safeDuration + seconds)
    : Math.max(0, currentRemaining + seconds);

  return {
    duration: restartingExpiredTimer
      ? nextRemaining
      : Math.max(1, safeDuration + nextRemaining - currentRemaining),
    endAt: now + nextRemaining * 1000,
  };
}
