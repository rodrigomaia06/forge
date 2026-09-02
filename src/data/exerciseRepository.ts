import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ExerciseCatalogItem } from './exerciseCatalog';

const CUSTOM_EXERCISES_KEY = '@forge/custom-exercises';

export async function loadCustomExercises(): Promise<ExerciseCatalogItem[]> {
  const value = await AsyncStorage.getItem(CUSTOM_EXERCISES_KEY);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown[];
    return Array.isArray(parsed)
      ? parsed.flatMap((item) => {
          if (!item || typeof item !== 'object') return [];
          const exercise = item as Partial<ExerciseCatalogItem>;
          if (typeof exercise.id !== 'string' || typeof exercise.name !== 'string' || typeof exercise.group !== 'string') return [];
          return [{
            id: exercise.id,
            name: exercise.name,
            group: exercise.group,
            variation: typeof exercise.variation === 'string' ? exercise.variation : undefined,
            equipment: typeof exercise.equipment === 'string' ? exercise.equipment : 'Bodyweight',
            category: typeof exercise.category === 'string' ? exercise.category : 'Accessories',
            aliases: Array.isArray(exercise.aliases) ? exercise.aliases.filter((value): value is string => typeof value === 'string') : [],
            workoutTypeIds: Array.isArray(exercise.workoutTypeIds) ? exercise.workoutTypeIds.filter((value): value is string => typeof value === 'string') : ['strength'],
            primaryMuscle: typeof exercise.primaryMuscle === 'string' ? exercise.primaryMuscle : (typeof exercise.category === 'string' ? exercise.category : 'Accessories'),
            secondaryMuscles: Array.isArray(exercise.secondaryMuscles) ? exercise.secondaryMuscles.filter((value): value is string => typeof value === 'string') : [],
            restSeconds: typeof exercise.restSeconds === 'number' && exercise.restSeconds >= 0 ? exercise.restSeconds : undefined,
          } satisfies ExerciseCatalogItem];
        })
      : [];
  } catch { return []; }
}

export function saveCustomExercises(exercises: ExerciseCatalogItem[]): Promise<void> {
  return AsyncStorage.setItem(CUSTOM_EXERCISES_KEY, JSON.stringify(exercises));
}
