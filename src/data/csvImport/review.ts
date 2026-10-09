import type { Workout, WorkoutRoutine } from '../../types';
import { importReviewRecords, routineReviewRecord, resolvedRoutine } from './routines';
import { importExerciseMatcher } from './exerciseMatching';
import type { ExerciseCatalogItem } from '../exerciseCatalog';
import { contentSignature } from '../importMatch';
import { createExerciseSnapshot } from '../../domain/exercises/exerciseSnapshot';
import { trackingFields } from '../../domain/exercises/tracking';
import { customVariationKey } from '../../domain/exercises/customIdentity';
import { createImportId } from '../dataTransferNormalization';
import { csvId } from './parse';
import type {
  CsvDraft,
  CsvMappings,
  ExerciseResolution,
  CsvSessionMatch,
  CsvImportRequest,
  CsvImportResult,
} from './types';

export function resolveCsvExercises(
  draft: CsvDraft,
  catalog: ExerciseCatalogItem[],
  mappings: CsvMappings,
): ExerciseResolution[] {
  const match = importExerciseMatcher(catalog);
  const byId = new Map(catalog.map((exercise) => [exercise.id, exercise]));
  const resolutions = new Map<string, ExerciseResolution>();
  for (const workout of importReviewRecords(draft))
    for (const exercise of workout.exercises) {
      const key = exercise.importKey!;
      if (resolutions.has(key)) continue;
      const remembered = byId.get(mappings[key]);
      resolutions.set(key, {
        key,
        name: exercise.name,
        trackingType: exercise.trackingType ?? 'weight-reps',
        exercise: remembered ?? match(exercise.name),
        remembered: Boolean(remembered),
      });
    }
  return [...resolutions.values()];
}
export function customCsvExercise(resolution: ExerciseResolution): ExerciseCatalogItem {
  return {
    id: createImportId(),
    name: resolution.name,
    group: resolution.name,
    equipment: 'Unspecified',
    equipmentIds: ['Unspecified'],
    primaryEquipment: 'Unspecified',
    category: 'Unspecified',
    primaryMuscle: '',
    secondaryMuscles: [],
    aliases: [],
    workoutTypeIds: [],
    trackingType: resolution.trackingType,
  };
}
export function applyCsvResolutions(draft: CsvDraft, resolutions: ExerciseResolution[]): Workout[] {
  const byKey = new Map(resolutions.map((resolution) => [resolution.key, resolution]));
  return importReviewRecords(draft).map((workout) => ({
    ...workout,
    exercises: workout.exercises.map((block) => {
      const resolved = byKey.get(block.importKey!);
      if (!resolved?.exercise) throw new Error(`Choose an exercise for ${block.name}.`);
      const exercise = resolved.exercise;
      const mode = exercise.trackingType ?? block.trackingType ?? 'weight-reps';
      const loaded =
        mode.startsWith('weighted-bodyweight') || mode.startsWith('assisted-bodyweight');
      // Prefer the source mode when the catalogue mode cannot represent its values.
      const incompatible = block.sets.some(
        (set) =>
          set.measurements?.some(
            (entry) =>
              entry.value !== 0 &&
              entry.kind !== 'rpe' &&
              !trackingFields[mode].includes(
                loaded && entry.kind === 'weight' ? 'addedWeight' : entry.kind,
              ),
          ) || set.plannedTargets?.some((target) => !trackingFields[mode].includes(target.kind)),
      );
      const selectedMode = incompatible ? (block.trackingType ?? mode) : mode;
      const selectedLoaded =
        selectedMode.startsWith('weighted-bodyweight') ||
        selectedMode.startsWith('assisted-bodyweight');
      const sets = block.sets.map((set) => ({
        ...set,
        measurements: set.measurements?.map((entry) =>
          selectedLoaded && entry.kind === 'weight'
            ? { ...entry, kind: 'addedWeight' as const }
            : entry,
        ),
      }));
      return {
        ...block,
        name: exercise.name,
        exerciseId: exercise.id,
        exerciseSnapshot: createExerciseSnapshot(exercise),
        trackingType: mode,
        trackingOverride: incompatible ? block.trackingType : undefined,
        sets,
      };
    }),
  }));
}
function sessionContent(workout: Workout): string {
  return contentSignature({
    name: workout.name,
    startedAt: workout.startedAt,
    completedAt: workout.completedAt,
    durationSeconds: workout.durationSeconds,
    note: workout.note,
    exercises: workout.exercises.map((exercise) => ({
      name: exercise.name,
      note: exercise.note ?? '',
      supersetId: exercise.supersetId,
      sets: exercise.sets.map((set) => ({
        weight: set.weight,
        reps: set.reps,
        comment: set.comment ?? '',
        tag: set.tag,
        measurements: set.measurements?.map(({ kind, unit, value }) => ({ kind, unit, value })),
      })),
    })),
  });
}
export function matchCsvSessions(workouts: Workout[], current: Workout[]): CsvSessionMatch[] {
  const sessions = new Map<string, Workout[]>();
  const contents = new Map<string, Workout[]>();
  for (const workout of current) {
    if (workout.importSource) {
      const key = workout.importSource.sessionKey;
      sessions.set(key, [...(sessions.get(key) ?? []), workout]);
    }
    const content = sessionContent(workout);
    contents.set(content, [...(contents.get(content) ?? []), workout]);
  }
  const seen = new Set<string>();
  return workouts.map((workout) => {
    const provenance = workout.importSource!;
    const repeated = `${provenance.sessionKey}:${provenance.fingerprint}`;
    const candidates = sessions.get(provenance.sessionKey) ?? [];
    const exact = candidates.find(
      (existing) => existing.importSource?.fingerprint === provenance.fingerprint,
    );
    const sameContent = contents.get(sessionContent(workout)) ?? [];
    // With provenance, changed source fields must remain reviewable even if Forge's visible values match.
    const legacyDuplicate =
      candidates.length === 0 && sameContent.length === 1 && !sameContent[0].importSource;
    const duplicate = seen.has(repeated) || Boolean(exact) || legacyDuplicate;
    seen.add(repeated);
    return {
      workout,
      status: duplicate
        ? 'duplicate'
        : candidates.length > 1 || sameContent.length > 1
          ? 'ambiguous'
          : candidates.length === 1
            ? 'changed'
            : 'new',
      existing:
        exact ??
        (candidates.length === 1
          ? candidates[0]
          : sameContent.length === 1
            ? sameContent[0]
            : undefined),
    };
  });
}
export function reviewStamp(match: CsvSessionMatch): string {
  return JSON.stringify([match.status, match.existing ?? null]);
}
export function prepareCsvCommit(
  request: CsvImportRequest,
  current: Workout[],
  custom: ExerciseCatalogItem[],
  catalog: ExerciseCatalogItem[],
  currentRoutines: WorkoutRoutine[] = [],
) {
  if (request.draft.requirements.length)
    throw new Error('Resolve the date and unit choices first.');
  if (request.draft.excluded && !request.acknowledged)
    throw new Error('Acknowledge the excluded workouts first.');
  const selected = new Set(request.selected);
  const confirmedMappings = new Set(request.confirmedMappingKeys ?? []);
  const draftKeys = new Set(
    importReviewRecords(request.draft).flatMap((workout) =>
      workout.exercises.map((exercise) => exercise.importKey),
    ),
  );
  for (const key of confirmedMappings)
    if (
      !draftKeys.has(key) ||
      !request.resolutions.some((resolution) => resolution.key === key && resolution.confirmed)
    )
      throw new Error('Review the exercise matches again before saving.');
  const existingIds = new Set(catalog.map((exercise) => exercise.id));
  const customByVariation = new Map<string, ExerciseCatalogItem>();
  for (const exercise of custom) {
    const key = customVariationKey(exercise);
    if (!customByVariation.has(key)) customByVariation.set(key, exercise);
  }
  const resolutions = request.resolutions.map((resolution) => {
    const existingCustom =
      resolution.custom && resolution.exercise
        ? customByVariation.get(customVariationKey(resolution.exercise))
        : undefined;
    if (existingCustom) return { ...resolution, exercise: existingCustom, custom: false };
    if (!resolution.exercise || (!resolution.custom && !existingIds.has(resolution.exercise.id)))
      throw new Error(
        `The exercise for ${resolution.name} is no longer available. Review its match.`,
      );
    return resolution;
  });
  const incoming = applyCsvResolutions(request.draft, resolutions);
  const incomingRoutineIds = new Set((request.draft.routines ?? []).map((routine) => routine.id));
  const matches = [
    ...matchCsvSessions(
      incoming.filter((record) => !incomingRoutineIds.has(record.id)),
      current,
    ),
    ...matchCsvSessions(
      incoming.filter((record) => incomingRoutineIds.has(record.id)),
      currentRoutines.map(routineReviewRecord),
    ),
  ];
  const workouts = [...current, ...currentRoutines.map(routineReviewRecord)],
    writes: Workout[] = [];
  const result: CsvImportResult = {
    added: 0,
    replaced: 0,
    duplicates: matches.filter((match) => match.status === 'duplicate').length,
    excluded: request.draft.excluded,
    customExercises: 0,
    mappingsSaved: 0,
  };
  for (const match of matches) {
    if (
      match.workout.exercises.some((exercise) => confirmedMappings.has(exercise.importKey!)) &&
      request.reviewed[match.workout.id] !== reviewStamp(match)
    )
      throw new Error(
        'Workouts changed during review. Review the sessions again before saving matches.',
      );
    if (!selected.has(match.workout.id) || match.status === 'duplicate') continue;
    if (request.reviewed[match.workout.id] !== reviewStamp(match))
      throw new Error(
        'Workouts changed during review. Review the sessions again before importing.',
      );
    const choice = request.choices[match.workout.id] ?? 'keep';
    if (match.status !== 'new' && choice === 'keep') continue;
    if (match.status === 'ambiguous' && choice === 'replace')
      throw new Error(
        'An ambiguous session cannot replace an existing workout. Keep it or import a separate copy.',
      );
    let workout = match.workout;
    if (match.status === 'changed' && choice === 'replace' && match.existing) {
      workout = { ...workout, id: match.existing.id };
      workouts[workouts.findIndex((entry) => entry.id === workout.id)] = workout;
      result.replaced++;
    } else {
      if (workouts.some((entry) => entry.id === workout.id))
        workout = { ...workout, id: csvId(`${workout.id}:${workout.importSource!.fingerprint}`) };
      if (workouts.some((entry) => entry.id === workout.id))
        throw new Error('This session identity is ambiguous. No records were saved.');
      workouts.push(workout);
      result.added++;
    }
    writes.push(workout);
  }
  const used = new Set([
    ...writes.flatMap((workout) => workout.exercises.map((exercise) => exercise.importKey)),
    ...confirmedMappings,
  ]);
  const customIds = new Set(custom.map((exercise) => exercise.id));
  const additions = resolutions
    .filter(
      (resolution) =>
        used.has(resolution.key) && resolution.custom && !customIds.has(resolution.exercise!.id),
    )
    .map((resolution) => resolution.exercise!);
  result.customExercises = additions.length;
  const mappings = Object.fromEntries(
    resolutions
      .filter((resolution) => used.has(resolution.key))
      .map((resolution) => [resolution.key, resolution.exercise!.id]),
  );
  result.mappingsSaved = Object.keys(mappings).length;
  const routineSources = new Map(
    (request.draft.routines ?? []).map((routine) => [routine.importSource!.sessionKey, routine]),
  );
  const routineWrites: WorkoutRoutine[] = [];
  const existingRoutinesById = new Map(currentRoutines.map((routine) => [routine.id, routine]));
  for (const record of writes) {
    const source = routineSources.get(record.importSource!.sessionKey);
    if (!source) continue;
    const existing = existingRoutinesById.get(record.id);
    routineWrites.push({
      ...resolvedRoutine(record, source),
      planId: existing?.planId,
      createdAt: existing?.createdAt ?? source.createdAt,
    });
    if (existing) {
      result.replaced--;
      result.routinesReplaced = (result.routinesReplaced ?? 0) + 1;
    } else {
      result.added--;
      result.routinesAdded = (result.routinesAdded ?? 0) + 1;
    }
  }
  const routineIds = new Set([...currentRoutines, ...routineWrites].map((routine) => routine.id));
  return {
    workouts: workouts.filter((record) => !routineIds.has(record.id)),
    writes: writes.filter((record) => !routineIds.has(record.id)),
    routineWrites,
    customExercises: [...custom, ...additions],
    additions,
    mappings,
    result,
  };
}
