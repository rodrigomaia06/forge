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

export function ExerciseCatalogProvider({ children }: ChildrenProps) {
  const [customExercises, setCustomExercises] = useState<ExerciseCatalogItem[]>([]);
  useEffect(() => {
    void loadCustomExercises().then(setCustomExercises);
  }, []);
  const addCustomExercise = (exercise: ExerciseCatalogItem) => {
    setCustomExercises((current) => {
      const next = [...current, exercise];
      void saveCustomExercises(next);
      return next;
    });
  };
  const updateCustomExercise = (exercise: ExerciseCatalogItem) => {
    setCustomExercises((current) => {
      const next = current.map((item) => (item.id === exercise.id ? exercise : item));
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
