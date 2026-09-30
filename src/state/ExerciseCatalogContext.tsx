import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { exerciseCatalog, type ExerciseCatalogItem } from '../data/exerciseCatalog';
import { warmCatalogIndex } from '../domain/exercises/catalogSelectors';
import { loadCustomExercises, saveCustomExercises } from '../data/exerciseRepository';
import type { ChildrenProps } from '../types';

type ExerciseCatalogContextValue = {
  exercises: ExerciseCatalogItem[];
  customExercises: ExerciseCatalogItem[];
  /** Returns false when the item was dropped as a duplicate variation (nothing persisted). */
  addCustomExercise: (exercise: ExerciseCatalogItem) => boolean;
  /** Returns false when the edit would collide with another variation (nothing persisted). */
  updateCustomExercise: (exercise: ExerciseCatalogItem) => boolean;
  removeCustomExercise: (id: string) => void;
  reload: () => Promise<void>;
};

const ExerciseCatalogContext = createContext<ExerciseCatalogContextValue | null>(null);

function variationKey(exercise: ExerciseCatalogItem): string {
  const facets = exercise.variationFacets
    ? Object.entries(exercise.variationFacets).flatMap(([key, value]) => Array.isArray(value) ? value.map((item) => `${key}:${item}`) : value ? [`${key}:${value}`] : [])
    : [];
  return [exercise.group, ...(facets.length ? facets : [exercise.variation || exercise.name]), ...(exercise.equipmentIds?.length ? [...exercise.equipmentIds].sort() : [exercise.equipment])]
    .map((value) => value.trim().toLocaleLowerCase())
    .join('\u0000');
}

function withoutDuplicateVariations(exercises: ExerciseCatalogItem[]): ExerciseCatalogItem[] {
  const seen = new Set<string>();
  return exercises.filter((exercise) => {
    const key = variationKey(exercise);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function ExerciseCatalogProvider({ children }: ChildrenProps) {
  const [customExercises, setCustomExercises] = useState<ExerciseCatalogItem[]>([]);
  const reload = React.useCallback(async (): Promise<void> => {
    const loaded = await loadCustomExercises();
    const unique = withoutDuplicateVariations(loaded);
    setCustomExercises(unique);
    if (unique.length !== loaded.length) await saveCustomExercises(unique);
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  // Warm the search/facet index for the bundled catalogue once, in idle chunks,
  // so the first exercise picker or browser opens without a synchronous
  // normalization spike on the phone.
  useEffect(() => {
    warmCatalogIndex(exerciseCatalog);
  }, []);
  // Persistence is computed and dispatched outside the state updater so it isn't
  // double-invoked under StrictMode/concurrent rendering, and so the caller can
  // learn whether the write actually happened (duplicate → dropped).
  const addCustomExercise = (exercise: ExerciseCatalogItem): boolean => {
    const next = withoutDuplicateVariations([...customExercises, exercise]);
    if (next.length === customExercises.length) return false;
    setCustomExercises(next);
    void saveCustomExercises(next);
    return true;
  };
  const updateCustomExercise = (exercise: ExerciseCatalogItem): boolean => {
    const mapped = customExercises.map((item) => (item.id === exercise.id ? exercise : item));
    const next = withoutDuplicateVariations(mapped);
    // The edit would collide with another existing variation, which the dedup
    // would silently drop — reject it instead of destroying a record.
    if (next.length !== mapped.length) return false;
    setCustomExercises(next);
    void saveCustomExercises(next);
    return true;
  };
  const removeCustomExercise = (id: string) => {
    const next = customExercises.filter((item) => item.id !== id);
    setCustomExercises(next);
    void saveCustomExercises(next);
  };
  const value = useMemo(
    () => ({
      exercises: [...exerciseCatalog, ...customExercises],
      customExercises,
      addCustomExercise,
      updateCustomExercise,
      removeCustomExercise,
      reload,
    }),
    [customExercises, reload],
  );
  return (
    <ExerciseCatalogContext.Provider value={value}>{children}</ExerciseCatalogContext.Provider>
  );
}

export function useExerciseCatalog(): ExerciseCatalogContextValue {
  const context = useContext(ExerciseCatalogContext);
  if (!context) throw new Error('useExerciseCatalog must be used inside ExerciseCatalogProvider');
  return context;
}
