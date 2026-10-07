const formatters = new Map<string, Intl.DateTimeFormat>();

export function dateFormatter(
  options: Intl.DateTimeFormatOptions,
  locale?: string,
): Intl.DateTimeFormat {
  const key = JSON.stringify([
    locale ?? null,
    Object.entries(options).sort(([a], [b]) => a.localeCompare(b)),
  ]);
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    formatters.set(key, formatter);
  }
  return formatter;
}

// The system locale can change while Forge is backgrounded.
export function refreshDateFormatters(): void {
  formatters.clear();
}
