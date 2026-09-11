import source from './default-exercises.json';

export interface BundledExercise {
  id: string;
  name: string;
  group: string;
  equipment: string;
  variation?: string;
  category: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  aliases: string[];
  workoutTypeIds: string[];
}

function validateCatalog(): BundledExercise[] {
  if (!Number.isInteger(source.version) || source.version < 1) {
    throw new Error('Bundled exercise catalogue must have a positive integer version.');
  }
  const ids = new Set<string>();
  return source.exercises.map((exercise, index) => {
    if (!exercise.id || !exercise.name || !exercise.group || !exercise.category || ids.has(exercise.id)) {
      throw new Error(`Invalid or duplicate bundled exercise at index ${index}.`);
    }
    if (!Array.isArray(exercise.aliases) || !Array.isArray(exercise.secondaryMuscles) || !Array.isArray(exercise.workoutTypeIds) || !exercise.workoutTypeIds.length) {
      throw new Error(`Bundled exercise ${exercise.id} has invalid classification data.`);
    }
    ids.add(exercise.id);
    return exercise;
  });
}

export const bundledCatalogVersion = source.version;
export const bundledExercises = validateCatalog();
