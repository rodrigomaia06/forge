import type { Workout, WorkoutSet } from '../../types';
import { measurementsFor } from '../../domain/exercises/tracking';

export interface CsvSessionChange {
  label: string;
  before: string;
  after: string;
}
function setLabel(set: WorkoutSet | undefined): string {
  if (!set) return 'No set';
  const values = measurementsFor(undefined, set).map(
    (entry) =>
      `${entry.value} ${entry.kind === 'reps' ? 'reps' : entry.kind === 'rpe' ? 'RPE' : entry.unit}`,
  );
  return [...values, set.tag, set.comment].filter(Boolean).join(' · ') || 'No recorded values';
}
/** Positions describe the source order; they do not decide import identity. */
export function csvSessionChanges(before: Workout, after: Workout): CsvSessionChange[] {
  const changes: CsvSessionChange[] = [];
  const add = (label: string, previous: string | undefined, next: string | undefined) => {
    if ((previous ?? '') !== (next ?? ''))
      changes.push({ label, before: previous || 'None', after: next || 'None' });
  };
  add('Workout name', before.name, after.name);
  add('Workout type', before.type, after.type);
  add('Session note', before.note, after.note);
  add(
    'Duration',
    before.durationSeconds === undefined ? undefined : `${before.durationSeconds} sec`,
    after.durationSeconds === undefined ? undefined : `${after.durationSeconds} sec`,
  );
  for (let index = 0; index < Math.max(before.exercises.length, after.exercises.length); index++) {
    const previous = before.exercises[index],
      next = after.exercises[index];
    const label = next?.name ?? previous.name;
    add(`Exercise ${index + 1}`, previous?.name, next?.name);
    add(`${label} note`, previous?.note, next?.note);
    add(`${label} superset`, previous?.supersetId, next?.supersetId);
    for (let set = 0; set < Math.max(previous?.sets.length ?? 0, next?.sets.length ?? 0); set++) {
      add(`${label}, set ${set + 1}`, setLabel(previous?.sets[set]), setLabel(next?.sets[set]));
      const oldSet = previous?.sets[set],
        newSet = next?.sets[set];
      if (oldSet && newSet && setLabel(oldSet) === setLabel(newSet)) {
        const keys = new Set([
          ...Object.keys(oldSet.importMetadata ?? {}),
          ...Object.keys(newSet.importMetadata ?? {}),
        ]);
        for (const key of keys)
          add(
            `${label}, set ${set + 1}: ${key}`,
            oldSet.importMetadata?.[key],
            newSet.importMetadata?.[key],
          );
      }
    }
  }
  return changes;
}
