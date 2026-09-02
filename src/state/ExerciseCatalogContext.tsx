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
};

const ExerciseCatalogContext = createContext<ExerciseCatalogContextValue | null>(null);

function variationKey(exercise: ExerciseCatalogItem): string {
  return [exercise.group, exercise.variation || exercise.name, exercise.equipment]
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
  useEffect(() => {
    void loadCustomExercises().then((loaded) => {
      const unique = withoutDuplicateVariations(loaded);
      setCustomExercises(unique);
      if (unique.length !== loaded.length) void saveCustomExercises(unique);
    });
  }, []);
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
    }),
    [customExercises],
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
