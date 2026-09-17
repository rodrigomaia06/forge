export interface RestTimerAdjustment {
  duration: number;
  endAt: number | null;
}

/**
 * Applies a rest-timer adjustment from timestamp state.
 *
 * An elapsed timer restarts as a fresh rest of exactly the added amount, so
 * "+30" on a finished rest yields 30 seconds — it neither stacks onto the
 * previous programmed duration nor carries overdue time into the next rest.
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
    ? Math.max(1, seconds)
    : Math.max(0, currentRemaining + seconds);

  return {
    duration: restartingExpiredTimer
      ? nextRemaining
      : Math.max(1, safeDuration + nextRemaining - currentRemaining),
    endAt: now + nextRemaining * 1000,
  };
}
