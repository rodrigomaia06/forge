/** Remaining fraction of the programmed duration, including manual adjustments. */
export function restTimerProgress(remaining: number, duration: number): number {
  return duration > 0 ? Math.max(0, Math.min(1, remaining / duration)) : 0;
}

export function restTimerPhase(remaining: number, duration: number): 'normal' | 'warning' | 'overdue' {
  if (remaining <= 0) return 'overdue';
  return restTimerProgress(remaining, duration) <= 0.2 ? 'warning' : 'normal';
}
