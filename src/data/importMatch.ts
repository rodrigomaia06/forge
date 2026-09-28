/**
 * Content identity for imported records, independent of the id and position
 * fields that a share intentionally re-mints. Two records with the same
 * signature carry the same content, so an identical re-import can be skipped
 * instead of piling up "X 2", "X 3" copies — the highest-value import rule:
 * never prompt for, or duplicate, an item the device already has verbatim.
 */
const DROP_KEYS = new Set(['id', 'planId']);

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    // Identity/parent-link fields are re-minted on a share, so they are noise
    // for a content comparison; everything else (including which exercise an
    // entry points at, via exerciseId) is kept.
    for (const key of Object.keys(source).sort()) {
      if (DROP_KEYS.has(key)) continue;
      out[key] = normalize(source[key]);
    }
    return out;
  }
  return value;
}

export function contentSignature(value: unknown): string {
  return JSON.stringify(normalize(value));
}

/**
 * Split incoming shared records into the ones the device already has verbatim
 * (identical content, to skip) and the genuinely new/different ones (to add).
 * Matching is by content, not name, so a re-shared item is recognised even
 * though its ids were re-minted.
 */
export function partitionIdentical<T>(
  incoming: readonly T[],
  current: readonly T[],
): { fresh: T[]; skipped: T[] } {
  const currentSignatures = new Set(current.map((item) => contentSignature(item)));
  const fresh: T[] = [];
  const skipped: T[] = [];
  for (const item of incoming) {
    (currentSignatures.has(contentSignature(item)) ? skipped : fresh).push(item);
  }
  return { fresh, skipped };
}
