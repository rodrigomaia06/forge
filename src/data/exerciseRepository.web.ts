import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ExerciseCatalogItem } from './exerciseCatalog';
import { uniqueById } from './uniqueById';

const KEY = '@forge/custom-exercises';
export async function loadCustomExercises(): Promise<ExerciseCatalogItem[]> {
  try {
    const value = await AsyncStorage.getItem(KEY);
    const parsed = value ? JSON.parse(value) as unknown : [];
    return Array.isArray(parsed) ? parsed.filter(isExercise) : [];
  } catch { return []; }
}
export async function saveCustomExercises(exercises: ExerciseCatalogItem[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(uniqueById(exercises)));
}
function isExercise(value: unknown): value is ExerciseCatalogItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ExerciseCatalogItem>;
  return typeof item.id === 'string' && typeof item.name === 'string' && typeof item.group === 'string';
}
