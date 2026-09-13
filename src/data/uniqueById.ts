/** Keep the first occurrence and preserve display order at every persistence boundary. */
export function uniqueById<T extends { id: string }>(items: readonly T[]): T[] {
  const ids = new Set<string>();
  return items.filter((item) => {
    if (ids.has(item.id)) return false;
    ids.add(item.id);
    return true;
  });
}
