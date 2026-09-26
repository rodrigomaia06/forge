// Pure reconstruction for the flattened, single-list drag reorder on the Plans
// tab. The list is one non-nested DraggableFlatList; on drop we rebuild the
// {plans, standalone} grouping from the flat row order. Kept dependency-free so
// it can be reasoned about and unit-tested in isolation.

export type FlatReorderItem =
  | { kind: 'section' }
  | { kind: 'plan-add' }
  | { kind: 'routine'; id: string }
  | { kind: 'plan-header'; id: string; routineIds: string[] };

export interface ReconstructedOrder {
  plans: { id: string; routineIds: string[] }[];
  standaloneIds: string[];
}

/**
 * Rebuilds the grouping from the post-drag flat order.
 *
 * - Dragging a plan header reorders the plans only; each plan keeps its own
 *   routines (they don't travel with the header row during the gesture), and
 *   the standalone group is whatever sits before the first plan header.
 * - Dragging a routine re-buckets it by where it landed: standalone until a
 *   plan header is passed, then that plan — which also moves it between plans.
 */
export function reconstructOrder(data: FlatReorderItem[], draggedIndex: number): ReconstructedOrder {
  const dragged = data[draggedIndex];

  if (dragged && dragged.kind === 'plan-header') {
    const plans = data
      .filter((item): item is Extract<FlatReorderItem, { kind: 'plan-header' }> => item.kind === 'plan-header')
      .map((item) => ({ id: item.id, routineIds: item.routineIds }));
    const standaloneIds: string[] = [];
    for (const item of data) {
      if (item.kind === 'plan-header') break;
      if (item.kind === 'routine') standaloneIds.push(item.id);
    }
    return { plans, standaloneIds };
  }

  const standaloneIds: string[] = [];
  const plans: { id: string; routineIds: string[] }[] = [];
  let bucket: { id: string; routineIds: string[] } | null = null;
  for (const item of data) {
    if (item.kind === 'plan-header') {
      bucket = { id: item.id, routineIds: [] };
      plans.push(bucket);
    } else if (item.kind === 'routine') {
      if (bucket) bucket.routineIds.push(item.id);
      else standaloneIds.push(item.id);
    }
  }
  return { plans, standaloneIds };
}
