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
  // Floor the hour/day steps so an event ~23.6h old reads "23 hours ago", not
  // "yesterday" (rounding up crossed the 24h boundary a whole hour early).
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(atMs).toLocaleDateString();
}
