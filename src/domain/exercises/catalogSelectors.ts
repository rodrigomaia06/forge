import type { ExerciseCatalogItem } from '../../data/exerciseCatalog';
import { taxonomyLabel } from '../../data/exerciseCatalog';

export type CatalogFilters = { query?: string; types?: string[]; equipment?: string[]; categories?: string[]; exerciseCategories?: string[]; includeGroupInSearch?: boolean };

/**
 * Keeps catalogue search tolerant of punctuation and the ordinary singular/
 * plural spellings used by imported libraries without changing a custom
 * exercise's stored name or identity.
 */
export function catalogSearchKey(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/\bpull[\s-]*ups?\b/g, 'pullup')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map((word) => word.length > 3 && /[^s]s$/.test(word) ? word.slice(0, -1) : word)
    .join(' ');
}

/**
 * Search and facet projection of one catalogue item, normalized once and reused
 * across every screen, query, and filter sheet. The catalogue is immutable for a
 * given item identity, so the index is memoized per item rather than recomputed
 * on each keystroke or filter pass.
 */
type CatalogItemIndex = {
  equipment: string[];
  muscles: string[];
  haystack: string;
  groupHaystack: string;
  // Granular normalized fields used to score how relevant a query is, so the
  // most on-point exercise (a name match) ranks above one that only matched a
  // muscle or equipment tag.
  name: string;
  nameWords: string[];
  aliasText: string;
  tagText: string;
};

const itemIndexCache = new WeakMap<ExerciseCatalogItem, CatalogItemIndex>();

function catalogItemIndex(item: ExerciseCatalogItem): CatalogItemIndex {
  const cached = itemIndexCache.get(item);
  if (cached) return cached;
  const equipment = item.equipmentIds?.map((id) => taxonomyLabel('equipment', id)) ?? [item.equipment];
  // Defensive against custom exercises persisted by older builds that lack some
  // array fields (aliases/secondaryMuscles) — spreading undefined here crashes
  // the whole browser.
  const secondaryMuscles = item.secondaryMuscles ?? [];
  const aliases = item.aliases ?? [];
  const muscles = [item.primaryMuscle, ...secondaryMuscles];
  const facetTerms = item.variationFacets
    ? Object.values(item.variationFacets).flatMap((value) => (Array.isArray(value) ? value : value ? [value] : []))
    : [];
  const searchable = [item.name, ...equipment, item.category, item.primaryMuscle, ...secondaryMuscles, ...aliases, ...(item.searchTerms ?? []), ...facetTerms];
  const name = catalogSearchKey(item.name);
  // Store one full haystack plus the small group-token string separately rather
  // than a second near-duplicate haystack that repeats every field. The group is
  // space-joined, so a single-word query term matches the combined text exactly
  // when checked against either piece.
  const index: CatalogItemIndex = {
    equipment,
    muscles,
    haystack: catalogSearchKey(searchable.join(' ')),
    groupHaystack: catalogSearchKey(item.group),
    name,
    nameWords: name ? name.split(' ') : [],
    aliasText: catalogSearchKey([...aliases, ...(item.searchTerms ?? [])].join(' ')),
    tagText: catalogSearchKey([...equipment, item.category, ...muscles, ...facetTerms].join(' ')),
  };
  itemIndexCache.set(item, index);
  return index;
}

/** True when `a` and `b` differ by at most one insert, delete, or substitution. */
function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  while (i < la && i < lb && a[i] === b[i]) i += 1;
  if (la === lb) return a.slice(i + 1) === b.slice(i + 1); // substitution
  return la > lb ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1); // delete / insert
}

/** True when any whitespace-separated word in `text` is within one edit of `token`. */
function fuzzyWordMatch(text: string, token: string): boolean {
  if (!text) return false;
  for (const word of text.split(' ')) {
    if (word.length >= 3 && withinOneEdit(word, token)) return true;
  }
  return false;
}

/**
 * Relevance of one query token against an item, best matching field wins. A name
 * hit ranks well above an alias, which ranks above a muscle/equipment tag; a
 * one-typo (fuzzy) hit is accepted but scores below an exact substring. Returns
 * 0 when the token matches nothing (the item is then excluded).
 */
function tokenScore(index: CatalogItemIndex, token: string, includeGroup: boolean): number {
  if (index.name === token) return 100;
  if (index.name.startsWith(`${token} `)) return 70;
  if (index.nameWords.some((word) => word === token)) return 58;
  if (index.nameWords.some((word) => word.startsWith(token))) return 46;
  if (index.name.includes(token)) return 30;
  if (index.aliasText.includes(token)) return 18;
  if (index.tagText.includes(token)) return 10;
  if (includeGroup && index.groupHaystack.includes(token)) return 10;
  // Typo tolerance kicks in only when nothing matched literally, and only for
  // tokens long enough that a single edit is unlikely to be a different word.
  if (token.length >= 4) {
    if (index.nameWords.some((word) => word.length >= 3 && withinOneEdit(word, token))) return 22;
    if (fuzzyWordMatch(index.aliasText, token)) return 8;
    if (fuzzyWordMatch(index.tagText, token)) return 5;
  }
  return 0;
}

/** Total relevance of an item for a query, or null when any token fails to match. */
function itemScore(index: CatalogItemIndex, terms: string[], query: string, includeGroup: boolean): number | null {
  let total = 0;
  for (const term of terms) {
    const score = tokenScore(index, term, includeGroup);
    if (score === 0) return null;
    total += score;
  }
  // Whole-query exactness and specificity break ties toward the tightest match.
  if (index.name === query) total += 200;
  else if (index.name.startsWith(`${query} `)) total += 40;
  return total;
}

/**
 * Precompute the per-item index for a whole catalogue in small chunks, off the
 * interaction path. Warming it once at startup keeps the first picker/browser
 * open from paying the full normalization cost in a single JS frame.
 */
export function warmCatalogIndex(items: ExerciseCatalogItem[], chunkSize = 40): void {
  let cursor = 0;
  const step = (): void => {
    const end = Math.min(cursor + chunkSize, items.length);
    for (; cursor < end; cursor += 1) catalogItemIndex(items[cursor]);
    if (cursor < items.length) {
      (globalThis.requestAnimationFrame ?? ((cb: () => void) => setTimeout(cb, 16)))(step);
    }
  };
  if (items.length) step();
}

export function filterCatalog(items: ExerciseCatalogItem[], filters: CatalogFilters): ExerciseCatalogItem[] {
  const query = catalogSearchKey(filters.query ?? '');
  const terms = query ? query.split(' ') : [];
  const includeGroup = Boolean(filters.includeGroupInSearch);
  const passesFacets = (item: ExerciseCatalogItem, index: CatalogItemIndex): boolean => {
    if (filters.types?.length && !item.workoutTypeIds.some((id) => filters.types?.includes(id))) return false;
    if (filters.equipment?.length && !index.equipment.some((value) => filters.equipment?.includes(value))) return false;
    if (filters.categories?.length && !index.muscles.some((muscle) => filters.categories?.includes(muscle))) return false;
    if (filters.exerciseCategories?.length && !filters.exerciseCategories.includes(item.category)) return false;
    return true;
  };

  // No query: keep the catalogue's own order after facet filtering.
  if (!terms.length) {
    return items.filter((item) => passesFacets(item, catalogItemIndex(item)));
  }

  // With a query, rank by relevance so the best match surfaces first. Facets and
  // token matching (tag-aware, order-independent, one-typo tolerant) narrow the
  // set; the score then sorts it, with the original order as a stable tiebreak.
  const ranked: { item: ExerciseCatalogItem; score: number; order: number }[] = [];
  items.forEach((item, order) => {
    const index = catalogItemIndex(item);
    if (!passesFacets(item, index)) return;
    const score = itemScore(index, terms, query, includeGroup);
    if (score === null) return;
    ranked.push({ item, score, order });
  });
  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const nameLength = catalogItemIndex(a.item).name.length - catalogItemIndex(b.item).name.length;
    if (nameLength !== 0) return nameLength;
    return a.order - b.order;
  });
  return ranked.map((entry) => entry.item);
}

const facetsCache = new WeakMap<ExerciseCatalogItem[], { equipment: string[]; categories: string[] }>();

export function catalogFacets(items: ExerciseCatalogItem[]): { equipment: string[]; categories: string[] } {
  const cached = facetsCache.get(items);
  if (cached) return cached;
  const facets = {
    equipment: [...new Set(items.flatMap((item) => catalogItemIndex(item).equipment))].sort(),
    categories: [...new Set(items.flatMap((item) => catalogItemIndex(item).muscles))].sort(),
  };
  facetsCache.set(items, facets);
  return facets;
}

export function groupCatalogByMovement(items: ExerciseCatalogItem[]): [string, ExerciseCatalogItem[]][] {
  return Object.entries(items.reduce<Record<string, ExerciseCatalogItem[]>>((groups, item) => { (groups[item.group] ??= []).push(item); return groups; }, {}));
}

/**
 * The picker exposes the load-bearing equipment as its child hierarchy. Support
 * equipment stays on the catalogue item for filtering, search, and snapshots.
 */
export function groupCatalogByPrimaryEquipment(items: ExerciseCatalogItem[]): [string, ExerciseCatalogItem[]][] {
  const groups = items.reduce<Record<string, ExerciseCatalogItem[]>>((current, item) => {
    const primaryEquipment = item.primaryEquipment ?? item.equipment;
    (current[primaryEquipment] ??= []).push(item);
    return current;
  }, {});
  return Object.entries(groups).map(([equipment, exercises]) => [
    taxonomyLabel('equipment', equipment),
    exercises,
  ]);
}
