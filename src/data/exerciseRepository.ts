import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ExerciseCatalogItem } from './exerciseCatalog';

const CUSTOM_EXERCISES_KEY = '@forge/custom-exercises';

export async function loadCustomExercises(): Promise<ExerciseCatalogItem[]> {
  const value = await AsyncStorage.getItem(CUSTOM_EXERCISES_KEY);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown[];
    return Array.isArray(parsed)
      ? parsed.filter((item): item is ExerciseCatalogItem => Boolean(item && typeof item === 'object' && typeof (item as ExerciseCatalogItem).id === 'string' && typeof (item as ExerciseCatalogItem).name === 'string' && typeof (item as ExerciseCatalogItem).group === 'string'))
      : [];
  } catch { return []; }
}

export function saveCustomExercises(exercises: ExerciseCatalogItem[]): Promise<void> {
  return AsyncStorage.setItem(CUSTOM_EXERCISES_KEY, JSON.stringify(exercises));
}
