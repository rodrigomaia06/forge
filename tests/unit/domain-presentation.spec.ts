import { expect, test } from '@playwright/test';
import { REST_DURATION_OPTIONS } from '../../src/domain/rest/restDurationOptions';
import { catalogFacets, filterCatalog, groupCatalogByPrimaryEquipment, groupCatalogByMovement } from '../../src/domain/exercises/catalogSelectors';
import { exerciseCatalog, taxonomyLabel } from '../../src/data/exerciseCatalog';
import { countWorkoutSets, formatCompactDuration, getWorkoutTypePresentation } from '../../src/domain/workouts/presentation';
import { defaultSettingsPreferences } from '../../src/data/settingsDefaults';
import { parseSettingsPreferences } from '../../src/data/settingsPreferences';
import { builtInWorkoutTypeColors } from '../../src/domain/workouts/workoutTypeDefaults';
import { lightTheme } from '../../src/theme/tokens';
import { bundledExercises, bundledLegacyIdMap, bundledCatalogVersion, validateCatalog } from '../../src/data/catalog/loadCatalog';
import catalogSource from '../../src/data/catalog/forge_exercise_catalog_v3_flat.json';
import { trackingFields } from '../../src/domain/exercises/tracking';
import { addExercisesToWorkout, addWarmupSetsToWorkout, createWorkout, recordRestTimerSample, updateWorkoutExercise } from '../../src/state/workoutMutations';
import { createExerciseSnapshot } from '../../src/domain/exercises/exerciseSnapshot';
import { formatExerciseMetadata, formatPickerPrimaryEquipment } from '../../src/domain/exercises/exercisePresentation';
import { buildWarmupPlan, warmupSteps } from '../../src/domain/workouts/warmup';
import { uniqueById } from '../../src/data/uniqueById';
import { mergeImportedPlans } from '../../src/data/dataTransferPlans';
import { normalizePersistedWorkout } from '../../src/data/workoutNormalization';

test('keeps the first stable record when a persistence boundary receives duplicate ids', () => {
  expect(uniqueById([
    { id: 'first', value: 1 },
    { id: 'duplicate', value: 2 },
    { id: 'duplicate', value: 3 },
    { id: 'last', value: 4 },
  ])).toEqual([
    { id: 'first', value: 1 },
    { id: 'duplicate', value: 2 },
    { id: 'last', value: 4 },
  ]);
});

test('merges imported routines into their existing plan without losing device order', () => {
  const current = {
    plans: [{
      id: 'push', name: 'Device push', createdAt: 1, updatedAt: 1,
      routines: [{ id: 'chest', name: 'Chest', type: 'Strength', exercises: [], planId: 'push', createdAt: 1, updatedAt: 1 }],
    }],
    standaloneRoutines: [{ id: 'walk', name: 'Walk', type: 'Cardio', exercises: [], createdAt: 1, updatedAt: 1 }],
  };
  const incoming = {
    plans: [{
      id: 'push', name: 'Imported push', createdAt: 2, updatedAt: 2,
      routines: [
        { id: 'chest', name: 'Imported chest', type: 'Strength', exercises: [], planId: 'push', createdAt: 2, updatedAt: 2 },
        { id: 'triceps', name: 'Triceps', type: 'Strength', exercises: [], planId: 'push', createdAt: 2, updatedAt: 2 },
      ],
    }, {
      id: 'pull', name: 'Pull', createdAt: 2, updatedAt: 2,
      routines: [{ id: 'back', name: 'Back', type: 'Strength', exercises: [], planId: 'pull', createdAt: 2, updatedAt: 2 }],
    }],
    standaloneRoutines: [{ id: 'walk', name: 'Imported walk', type: 'Cardio', exercises: [], createdAt: 2, updatedAt: 2 }],
  };

  const merged = mergeImportedPlans(current, incoming);
  expect(merged.plans.map((plan) => plan.id)).toEqual(['push', 'pull']);
  expect(merged.plans[0]).toMatchObject({ name: 'Device push' });
  expect(merged.plans[0].routines.map((routine) => routine.id)).toEqual(['chest', 'triceps']);
  expect(merged.plans[0].routines[0]).toMatchObject({ name: 'Chest', planId: 'push' });
  expect(merged.plans[1].routines.map((routine) => routine.id)).toEqual(['back']);
  expect(merged.standaloneRoutines).toEqual([expect.objectContaining({ id: 'walk', name: 'Walk' })]);
});

test('formats compact workout durations and counts sets', () => {
  expect([0, 59, 3600, 4320].map(formatCompactDuration)).toEqual(['1m', '1m', '1:00h', '1:12h']);
  expect(countWorkoutSets({ exercises: [{ sets: [] }, { sets: [{}, {}] }] } as never)).toBe(2);
});

test('keeps a truthful average for only the rest intervals Forge started', () => {
  const workout = {
    id: 'workout', name: 'Push', type: 'Strength', startedAt: 1, completedAt: null, note: '', exercises: [],
  };
  const first = recordRestTimerSample(workout, 90);
  const second = recordRestTimerSample(first, 120);
  expect(second).toMatchObject({ averageRestSeconds: 105, restTimerSamples: 2 });

  const legacy = recordRestTimerSample({ ...workout, averageRestSeconds: 60 }, 120);
  expect(legacy).toMatchObject({ averageRestSeconds: 90, restTimerSamples: 2 });
});

test('normalizes legacy workout child collections before screens consume them', () => {
  const workout = normalizePersistedWorkout({
    id: 'legacy-workout', name: 'Legacy', type: 'Strength', startedAt: 1,
    completedAt: 2, note: '', exercises: undefined as never,
  });
  const partialExercise = normalizePersistedWorkout({
    id: 'partial-workout', name: 'Partial', type: 'Strength', startedAt: 1,
    completedAt: 2, note: '', exercises: [{ id: 'exercise', name: 'Bench', sets: undefined as never }],
  });
  expect(workout.exercises).toEqual([]);
  expect(partialExercise.exercises[0].sets).toEqual([]);
});

test('presents saved, fallback, custom, and unknown workout types consistently', () => {
  const types = defaultSettingsPreferences.workoutTypes;
  expect(getWorkoutTypePresentation('Court sport', types, lightTheme, 0.14)).toMatchObject({
    icon: 'tennis-ball',
    color: '#6BD48F',
    background: 'rgba(107,212,143,0.14)',
  });
  expect(getWorkoutTypePresentation('Strength', [], lightTheme, 0.16)).toMatchObject({
    icon: 'fitness-outline',
    color: '#7C8CF8',
    background: 'rgba(124,140,248,0.16)',
  });
  expect(
    getWorkoutTypePresentation(
      'Recovery',
      [{ id: 'recovery', name: 'Recovery', color: '#123456', source: 'custom' }],
      lightTheme,
      0.2,
    ),
  ).toMatchObject({ icon: 'fitness-outline', color: '#123456', background: 'rgba(18,52,86,0.20)' });
  expect(getWorkoutTypePresentation('Unknown', types, lightTheme, 0.16)).toMatchObject({
    icon: 'fitness-outline',
    color: lightTheme.muted,
    background: 'rgba(138,150,158,0.16)',
  });
  expect(REST_DURATION_OPTIONS).toEqual(
    Array.from({ length: 115 }, (_, index) => 30 + index * 5),
  );
});

test('uses the original Forge swatches for built-ins without duplicates', () => {
  const builtIns = defaultSettingsPreferences.workoutTypes;
  expect(builtIns.map((type) => type.color)).toHaveLength(new Set(builtIns.map((type) => type.color)).size);
  expect(builtInWorkoutTypeColors).toMatchObject({
    strength: '#7C8CF8',
    'court-sport': '#6BD48F',
    'martial-arts': '#F27D7D',
    cardio: '#F4A261',
    mobility: '#B78AF0',
  });
  const migrated = parseSettingsPreferences(JSON.stringify({
    workoutTypes: defaultSettingsPreferences.workoutTypes.map((type) =>
      type.id === 'strength' ? { ...type, color: '#687CF2' } : type,
    ),
  }));
  expect(migrated.workoutTypes.find((type) => type.id === 'strength')?.color).toBe('#7C8CF8');
});

test('allows custom workout types to reuse an included Forge colour', () => {
  const parsed = parseSettingsPreferences(JSON.stringify({
    workoutTypes: [
      ...defaultSettingsPreferences.workoutTypes,
      { id: 'custom-strength', name: 'Custom strength', color: '#7C8CF8', source: 'custom' },
    ],
  }));
  expect(parsed.workoutTypes.find((type) => type.id === 'custom-strength')).toMatchObject({
    color: '#7C8CF8',
    source: 'custom',
  });
});

test('filters and groups exercise catalog entries without changing feature selection state', () => {
  const items = [
    { id: 'bench', name: 'Close grip', group: 'Bench Cluster', equipment: 'Barbell & Bench', equipmentIds: ['barbell', 'bench'], primaryEquipment: 'barbell', category: 'Chest', primaryMuscle: 'Triceps', secondaryMuscles: ['Chest'], aliases: ['press'], workoutTypeIds: ['strength'] },
    { id: 'pec', name: 'Pec Deck', group: 'Pec Deck', equipment: 'Machine', equipmentIds: ['machine'], primaryEquipment: 'machine', category: 'Chest', primaryMuscle: 'Chest', secondaryMuscles: [], aliases: ['fly'], workoutTypeIds: ['strength'] },
  ];
  expect(filterCatalog(items, { query: 'cluster', includeGroupInSearch: false })).toHaveLength(0);
  expect(filterCatalog(items, { query: 'bench cluster', includeGroupInSearch: true })).toHaveLength(1);
  expect(filterCatalog(items, { query: 'fly', equipment: ['Machine'], categories: ['Chest'] })).toEqual([items[1]]);
  expect(filterCatalog(items, { categories: ['Triceps'] })).toEqual([items[0]]);
  expect(filterCatalog(items, { exerciseCategories: ['Chest'] })).toEqual(items);
  expect(filterCatalog([...items, { ...items[0], id: 'conditioning-press', category: 'Cardio' }], { exerciseCategories: ['Chest'] })).toEqual(items);
  expect(filterCatalog(items, { query: 'triceps' })).toEqual([items[0]]);
  expect(catalogFacets(items)).toEqual({ equipment: ['Barbell', 'Bench', 'Machine'], categories: ['Chest', 'Triceps'] });
  expect(groupCatalogByMovement(items).map(([name]) => name)).toEqual(['Bench Cluster', 'Pec Deck']);
  expect(groupCatalogByPrimaryEquipment(items).map(([name]) => name)).toEqual(['Barbell', 'Machine']);
  // Support equipment remains an all-equipment filter even though the hierarchy shows Barbell.
  expect(filterCatalog(items, { equipment: ['Bench'] })).toEqual([items[0]]);
});

test('ships the validated v3 baseline, unique picker identities, and all built-in workout types', () => {
  expect(bundledCatalogVersion).toBe(3);
  expect(bundledExercises).toHaveLength(381);
  expect(new Set(bundledExercises.map((exercise) => exercise.id)).size).toBe(381);
  const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
  expect(new Set(bundledExercises.map((exercise) => normalize(exercise.name))).size).toBe(381);
  expect(bundledExercises.some((exercise) => exercise.variation && normalize(exercise.variation) === normalize(exercise.name))).toBe(false);
  const pickerKeys = bundledExercises.map((exercise) => [
    normalize(exercise.group),
    [...exercise.equipment].map(normalize).sort().join('|'),
    normalize(exercise.variation || exercise.name),
  ].join('::'));
  expect(new Set(pickerKeys).size).toBe(381);
  const byId = new Map(bundledExercises.map((exercise) => [exercise.id, exercise]));
  expect([...byId.values()].filter((exercise) => exercise.group === 'Bench Press').map((exercise) => exercise.id).sort()).toEqual([
    'barbell-bench-press',
    'dumbbell-bench-press',
    'smith-machine-bench-press',
  ]);
  expect(byId.get('floor-press-barbell')).toMatchObject({ familyId: 'floor-press', group: 'Floor Press' });
  expect(byId.get('floor-press-dumbbell')).toMatchObject({ familyId: 'floor-press', group: 'Floor Press' });
  expect(byId.get('machine-chest-press')).toMatchObject({ familyId: 'chest-press', group: 'Chest Press' });
  const benchPresses = exerciseCatalog.filter((exercise) => exercise.group === 'Bench Press');
  expect(groupCatalogByPrimaryEquipment(benchPresses).map(([equipment]) => equipment)).toEqual([
    'Barbell',
    'Dumbbell',
    'Smith Machine',
  ]);
  expect(filterCatalog(exerciseCatalog, { equipment: ['Bench'] }).map((exercise) => exercise.id)).toContain('barbell-bench-press');
  expect(bundledLegacyIdMap.dips).toBe('parallel-bar-dip');
  expect(defaultSettingsPreferences.workoutTypes.map((type) => type.id)).toEqual(['strength', 'calisthenics', 'cardio', 'mobility', 'functional', 'olympic-weightlifting', 'plyometrics', 'court-sport', 'field-sport', 'martial-arts']);
});

test('rejects duplicate catalogue names and picker labels before release data is exposed', () => {
  const [first] = catalogSource.exercises;
  const duplicateName = {
    ...catalogSource,
    exercises: catalogSource.exercises.map((exercise, index) => index === 1 ? { ...first, id: 'duplicate-name', name: ` ${first.name} ` } : exercise),
  };
  const duplicatePickerLabel = {
    ...catalogSource,
    exercises: catalogSource.exercises.map((exercise, index) => index === 1 ? { ...first, id: 'duplicate-picker-label', name: 'Different exercise', variation: first.variation ?? first.name } : exercise),
  };
  const redundantVariation = {
    ...catalogSource,
    exercises: catalogSource.exercises.map((exercise, index) => index === 0 ? { ...exercise, variation: exercise.name } : exercise),
  };

  expect(() => validateCatalog(duplicateName as Parameters<typeof validateCatalog>[0])).toThrow('duplicate exercise name');
  expect(() => validateCatalog(duplicatePickerLabel as Parameters<typeof validateCatalog>[0])).toThrow('duplicates a picker variation');
  expect(() => validateCatalog(redundantVariation as Parameters<typeof validateCatalog>[0])).toThrow('repeats its name as a variation');
});

test('tracking modes specify only their applicable measurements and retain an exercise snapshot', () => {
  expect(Object.keys(trackingFields)).toHaveLength(9);
  expect(trackingFields['distance-duration']).toEqual(['distance', 'duration']);
  const exercise = bundledExercises.find((item) => item.id === 'parallel-bar-dip')!;
  const workout = createWorkout({ exercises: [{ exerciseId: exercise.id, name: exercise.name, trackingType: exercise.trackingType, exerciseSnapshot: { id: exercise.id, name: exercise.name, catalogueVersion: 3, trackingType: exercise.trackingType } }] });
  expect(workout.exercises[0]).toMatchObject({ exerciseId: 'parallel-bar-dip', trackingType: exercise.trackingType, exerciseSnapshot: { id: 'parallel-bar-dip', catalogueVersion: 3 } });
});

test('keeps routine intervals advisory and never turns them into next-session targets', () => {
  const routineWorkout = createWorkout({
    routineId: 'routine-upper',
    exercises: [{
      name: 'Bench Press',
      sets: [{
        id: 'set-1',
        targetReps: '8–12',
        targets: [{ id: 'old-routine-target', kind: 'reps', unit: 'count', minValue: 8, maxValue: 12 }],
        plannedTargets: [{ id: 'routine-interval', kind: 'reps', unit: 'count', minValue: 8, maxValue: 12 }],
      }],
    }],
  });
  expect(routineWorkout.exercises[0].sets[0]).toMatchObject({ plannedTargets: [{ minValue: 8, maxValue: 12 }] });
  expect(routineWorkout.exercises[0].sets[0].targets).toBeUndefined();
  expect(routineWorkout.exercises[0].sets[0].targetReps).toBeUndefined();

  const directWorkout = createWorkout({ exercises: [{ name: 'Bench Press', sets: [{ id: 'set-2', targetReps: '10' }] }] });
  expect(directWorkout.exercises[0].sets[0].targetReps).toBe('10');
});

test('snapshots keep variation and primary-equipment metadata while legacy cards remain name-only', () => {
  const bench = exerciseCatalog.find((exercise) => exercise.id === 'barbell-bench-press')!;
  const weightedDip = exerciseCatalog.find((exercise) => exercise.id === 'weighted-dip')!;
  const assistedDip = exerciseCatalog.find((exercise) => exercise.id === 'assisted-dip')!;
  expect(createExerciseSnapshot(bench)).toMatchObject({
    group: 'Bench Press',
    variation: 'Flat',
    primaryEquipment: 'barbell',
  });
  expect(formatExerciseMetadata(createExerciseSnapshot(bench))).toBe('Flat · Barbell');
  expect(formatExerciseMetadata(createExerciseSnapshot(weightedDip))).toBe('Dip Bars');
  expect(formatExerciseMetadata(createExerciseSnapshot(assistedDip))).toBe('Machine');
  expect(formatPickerPrimaryEquipment(assistedDip, 'Machine')).toBe('Machine · Assisted');
  const weightedExercises = exerciseCatalog.filter((exercise) => /\bweighted\b/i.test(exercise.name));
  expect(weightedExercises).not.toHaveLength(0);
  for (const exercise of weightedExercises) {
    expect(formatExerciseMetadata(createExerciseSnapshot(exercise))?.toLocaleLowerCase()).not.toMatch(/^weighted\b/);
  }
  for (const exercise of exerciseCatalog) {
    const metadata = formatExerciseMetadata(createExerciseSnapshot(exercise));
    const equipment = taxonomyLabel('equipment', exercise.primaryEquipment ?? '');
    const variation = (exercise.variation ?? '')
      .replace(new RegExp(equipment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), '')
      .replace(/[·,–—-]+/g, ' ')
      .trim();
    const variationWords = variation.toLocaleLowerCase().match(/[a-z0-9]+/g) ?? [];
    const titleWords = new Set(exercise.name.toLocaleLowerCase().match(/[a-z0-9]+/g) ?? []);
    if (variationWords.length && variationWords.every((word) => titleWords.has(word))) {
      expect(metadata?.split(' · ').filter((part) => part !== equipment)).not.toContain(variation);
    }
  }
  const assistedExercises = exerciseCatalog.filter((exercise) => exercise.trackingType === 'assisted-bodyweight');
  expect(assistedExercises).toHaveLength(5);
  for (const exercise of assistedExercises) {
    expect(formatPickerPrimaryEquipment(exercise, exercise.primaryEquipment ?? exercise.equipment)).toMatch(/ · Assisted$/);
  }
  expect(formatExerciseMetadata({ name: 'Legacy Bench Press', trackingType: 'weight-reps' })).toBeNull();
});

test('adds picker selections in one immutable workout update with three empty sets each', () => {
  const source = createWorkout({ exercises: [{ name: 'Existing' }] });
  const next = addExercisesToWorkout(source, [
    { exerciseId: 'bench', name: 'Bench Press', trackingType: 'weight-reps', exerciseSnapshot: { id: 'bench', name: 'Bench Press', catalogueVersion: 3, trackingType: 'weight-reps' } },
    { exerciseId: 'walk', name: 'Walk', trackingType: 'duration', exerciseSnapshot: { id: 'walk', name: 'Walk', catalogueVersion: 3, trackingType: 'duration' } },
  ]);

  expect(next).not.toBe(source);
  expect(next?.exercises).toHaveLength(3);
  expect(next?.exercises.slice(1)).toEqual(expect.arrayContaining([
    expect.objectContaining({ exerciseId: 'bench', trackingType: 'weight-reps', exerciseSnapshot: expect.objectContaining({ id: 'bench', catalogueVersion: 3 }) }),
    expect.objectContaining({ exerciseId: 'walk', trackingType: 'duration', exerciseSnapshot: expect.objectContaining({ id: 'walk', catalogueVersion: 3 }) }),
  ]));
  expect(next?.exercises.slice(1).every((exercise) => exercise.sets.length === 3)).toBe(true);
  expect(next?.exercises.slice(1).flatMap((exercise) => exercise.sets)).toEqual(
    expect.arrayContaining([expect.objectContaining({ weight: '', reps: '', completed: false })]),
  );
});

test('builds progressive warm-up plans and inserts them before working sets immutably', () => {
  expect(warmupSteps(3)).toEqual([[0.4, 5], [0.55, 3], [0.7, 2], [0.85, 1]]);
  expect(buildWarmupPlan(100, 8)).toEqual([
    { weight: '40', reps: '8' },
    { weight: '60', reps: '5' },
    { weight: '80', reps: '3' },
  ]);
  expect(buildWarmupPlan(20, 8)).toEqual([]);

  const source = createWorkout({ exercises: [{ id: 'bench', name: 'Bench Press', sets: [{ id: 'working', weight: '100', reps: '8' }] }] });
  const next = addWarmupSetsToWorkout(source, 'bench', buildWarmupPlan(100, 8));
  expect(next).not.toBe(source);
  expect(source.exercises[0].sets).toHaveLength(1);
  expect(next?.exercises[0].sets.map((set) => [set.tag, set.weight, set.reps])).toEqual([
    ['Warm Up', '40', '8'],
    ['Warm Up', '60', '5'],
    ['Warm Up', '80', '3'],
    [undefined, '100', '8'],
  ]);

  const annotated = updateWorkoutExercise(next, 'bench', { note: 'Pause on the chest' });
  expect(annotated?.exercises[0]).toMatchObject({ note: 'Pause on the chest' });
  expect(next?.exercises[0].note).toBeUndefined();
});

test('v3 multi-equipment facets remain individual taxonomy labels', () => {
  const multiEquipment = exerciseCatalog.find((exercise) => (exercise.equipmentIds?.length ?? 0) > 1)!;
  const facets = catalogFacets([multiEquipment]);
  expect(facets.equipment).toEqual(multiEquipment.equipment.split(' & ').sort());
  expect(facets.equipment).not.toContain(multiEquipment.equipment);
});
