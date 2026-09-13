import type { WorkoutSet } from '../../types';

/** One presentation source for set tags in Active Workout and history. */
export const SET_TAG_PRESENTATIONS = [
  { label: 'Warm Up', letter: 'W', color: '#FF8A2A' },
  { label: 'Drop Set', letter: 'D', color: '#9637DD' },
  { label: 'Failure', letter: 'F', color: '#F0444D' },
  { label: 'Back-Off', letter: 'B', color: '#2C78E8' },
] as const;

export type SetTagPresentation = (typeof SET_TAG_PRESENTATIONS)[number];

/** Legacy records may use small spelling differences, but keep their intent. */
export function setTagPresentation(tag?: string): SetTagPresentation | undefined {
  const normalized = tag?.trim().toLocaleLowerCase().replace(/[\s-]+/g, ' ');
  if (!normalized) return undefined;
  return SET_TAG_PRESENTATIONS.find(
    (item) => item.label.toLocaleLowerCase().replace(/[\s-]+/g, ' ') === normalized,
  );
}

/** Legacy target fields and field-specific targets both mark a suggested next set. */
export function hasNextSessionTarget(set: WorkoutSet): boolean {
  return Boolean(
    set.targets?.some((target) => target.minValue !== undefined || target.maxValue !== undefined)
      || set.targetWeight?.trim()
      || set.targetReps?.trim(),
  );
}
