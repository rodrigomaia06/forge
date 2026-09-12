/** Local calendar-day helpers. Calendar dates must not shift with UTC conversion. */
export function calendarDateKey(value: Date | number): string {
  const date = typeof value === 'number' ? new Date(value) : value;
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

export function parseCalendarDate(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) return fallback;
  const date = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
  return Number.isNaN(date.getTime()) ? fallback : date;
}
