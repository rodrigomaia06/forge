import { expect, test } from '@playwright/test';
import { exerciseCatalog } from '../../src/data/exerciseCatalog';
import { importExerciseMatcher } from '../../src/data/csvImport/exerciseMatching';
import { resolveCsvExercises } from '../../src/data/csvImport/review';
import type { CsvSource, CsvDraft } from '../../src/data/csvImport/types';

const names = [
  ['Bulgarian split squat (Dumbbell)', 'bulgarian-split-squat-dumbbell'],
  ['Crunch (Machine)', 'machine-crunch'],
  ['Bicep curl (Dumbbell)', 'dumbbell-curl'],
  ['Ab wheel', 'ab-wheel-rollout'],
  ['Incline Bench Press (Barbell)', 'incline-barbell-bench-press'],
  ['Bicep curl (Cable)', 'cable-curl'],
  ['Lateral raise (Dumbbell)', 'dumbbell-lateral-raise'],
  ['Rear delt fly (Machine)', 'reverse-pec-deck'],
  ['Lat pulldown (Cable)', 'lat-pulldown'],
  ['One arm cable row', 'single-arm-cable-row'],
  ['Skullcrusher (Dumbbell)', 'dumbbell-skull-crusher'],
] as const;
for (const source of ['hevy', 'strong', 'fitnotes', 'fitnotes-ios', 'strive'] as CsvSource[]) {
  test(`${source} automatically matches explicit equipment and common naming variants`, () => {
    const draft: CsvDraft = {
      source,
      issues: [],
      excluded: 0,
      requirements: [],
      limitations: [],
      workouts: [
        {
          id: 'source',
          name: 'Source',
          type: 'Strength',
          startedAt: 0,
          completedAt: 1,
          note: '',
          exercises: names.map(([name], i) => ({
            id: String(i),
            name,
            importKey: `${source}:${name}`,
            sets: [],
          })),
        },
      ],
    };
    const resolved = resolveCsvExercises(draft, exerciseCatalog, {});
    expect(resolved.map((item) => item.exercise?.id)).toEqual(names.map(([, id]) => id));
  });
}
test('matching respects movement modifiers, conflicting equipment and ambiguous aliases', () => {
  const match = importExerciseMatcher(exerciseCatalog);
  expect(match('Tricep extension')).toBeUndefined();
  expect(match('Tricep extension (Cable)')).toBeUndefined();
  expect(match('Bicep curl')).toBeUndefined();
  expect(match('Unknown Dumbbell Bulgarian split squat')).toBeUndefined();
  expect(match('Bench Press (Dumbbell)')?.id).toBe('dumbbell-bench-press');
  expect(match('Incline DB Bench Press')?.id).toBe('incline-dumbbell-press');
  expect(match('Single Arm Cable Curl')?.id).toBe('single-arm-cable-curl');
  expect(match('Crunch')?.id).toBe('crunch');
  for (const exercise of exerciseCatalog.filter((item) =>
    item.name.toLowerCase().includes('dumbbell'),
  )) {
    const words = exercise.name.split(/\s+/);
    const formatted = `${words.filter((word) => word.toLowerCase() !== 'dumbbell').join(' ')} (DB)`;
    if (match(exercise.name)?.id === exercise.id) expect(match(formatted)?.id).toBe(exercise.id);
  }
  const duplicate = {
    ...exerciseCatalog.find((item) => item.id === 'dumbbell-curl')!,
    id: 'custom-copy',
  };
  expect(
    importExerciseMatcher([...exerciseCatalog, duplicate])('Bicep curl (Dumbbell)'),
  ).toBeUndefined();
});
