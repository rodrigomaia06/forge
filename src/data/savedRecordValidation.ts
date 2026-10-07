/** Missing optional child arrays are legacy data; missing record identity is corruption. */
export function hasSavedId(value: unknown): value is { id: string } {
  return Boolean(value) && typeof value === 'object' &&
    typeof (value as { id?: unknown }).id === 'string' &&
    (value as { id: string }).id.length > 0;
}

export function requireSavedId(value: unknown): void {
  if (!hasSavedId(value)) throw new Error('Saved record could not be read.');
}
