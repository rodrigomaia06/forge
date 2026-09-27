/**
 * Compact, human relative time for local timestamps (log rows, last-backup
 * indicators). Falls back to a localized date once an event is over a week old,
 * where "3 days ago" stops being the most useful phrasing.
 */
export function relativeTime(atMs: number, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - atMs) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(atMs).toLocaleDateString();
}
