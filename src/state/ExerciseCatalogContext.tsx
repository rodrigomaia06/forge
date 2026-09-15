import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { exerciseCatalog, type ExerciseCatalogItem } from '../data/exerciseCatalog';
import { loadCustomExercises, saveCustomExercises } from '../data/exerciseRepository';
import type { ChildrenProps } from '../types';

type ExerciseCatalogContextValue = {
  exercises: ExerciseCatalogItem[];
  customExercises: ExerciseCatalogItem[];
  addCustomExercise: (exercise: ExerciseCatalogItem) => void;
  updateCustomExercise: (exercise: ExerciseCatalogItem) => void;
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
  const addCustomExercise = (exercise: ExerciseCatalogItem) => {
    setCustomExercises((current) => {
      const next = withoutDuplicateVariations([...current, exercise]);
      if (next.length === current.length) return current;
      void saveCustomExercises(next);
      return next;
    });
  };
  const updateCustomExercise = (exercise: ExerciseCatalogItem) => {
    setCustomExercises((current) => {
      const next = withoutDuplicateVariations(
        current.map((item) => (item.id === exercise.id ? exercise : item)),
      );
      void saveCustomExercises(next);
      return next;
    });
  };
  const removeCustomExercise = (id: string) => {
    setCustomExercises((current) => {
      const next = current.filter((item) => item.id !== id);
      void saveCustomExercises(next);
      return next;
    });
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
