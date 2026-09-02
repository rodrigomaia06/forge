export interface ExerciseCatalogItem {
  id: string;
  name: string;
  group: string;
  equipment: string;
  variation?: string;
  category: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  /** A custom-exercise-only override. Built-in overrides live in Settings. */
  restSeconds?: number;
  aliases: string[];
  workoutTypeIds: string[];
}

const strengthCatalog: Omit<
  ExerciseCatalogItem,
  'workoutTypeIds' | 'primaryMuscle' | 'secondaryMuscles'
>[] = [
  {
    id: 'barbell-bench-press',
    name: 'Barbell Bench Press',
    group: 'Bench Press',
    equipment: 'Barbell',
    variation: 'Standard',
    category: 'Chest',
    aliases: ['bench', 'press'],
  },
  {
    id: 'barbell-bench-press-close-grip',
    name: 'Barbell Close Grip Bench Press',
    group: 'Bench Press',
    equipment: 'Barbell',
    variation: 'Close grip',
    category: 'Chest',
    aliases: ['bench', 'barbell', 'close grip', 'triceps'],
  },
  {
    id: 'incline-dumbbell-press',
    name: 'Incline Dumbbell Press',
    group: 'Incline Bench Press',
    equipment: 'Dumbbell',
    category: 'Chest',
    aliases: ['incline', 'press'],
  },
  {
    id: 'incline-smith-press',
    name: 'Incline Smith Press',
    group: 'Incline Bench Press',
    equipment: 'Smith machine',
    category: 'Chest',
    aliases: ['incline', 'smith', 'press'],
  },
  {
    id: 'incline-barbell-press',
    name: 'Incline Barbell Press',
    group: 'Incline Bench Press',
    equipment: 'Barbell',
    category: 'Chest',
    aliases: ['incline', 'barbell', 'press'],
  },
  {
    id: 'dumbbell-bench-press',
    name: 'Dumbbell Bench Press',
    group: 'Bench Press',
    equipment: 'Dumbbell',
    category: 'Chest',
    aliases: ['bench', 'dumbbell', 'press'],
  },
  {
    id: 'smith-bench-press',
    name: 'Smith Machine Bench Press',
    group: 'Bench Press',
    equipment: 'Smith machine',
    category: 'Chest',
    aliases: ['bench', 'smith', 'press'],
  },
  {
    id: 'decline-barbell-press',
    name: 'Decline Barbell Press',
    group: 'Decline Bench Press',
    equipment: 'Barbell',
    category: 'Chest',
    aliases: ['decline', 'barbell', 'press'],
  },
  {
    id: 'decline-dumbbell-press',
    name: 'Decline Dumbbell Press',
    group: 'Decline Bench Press',
    equipment: 'Dumbbell',
    category: 'Chest',
    aliases: ['decline', 'dumbbell', 'press'],
  },
  {
    id: 'decline-smith-press',
    name: 'Decline Smith Press',
    group: 'Decline Bench Press',
    equipment: 'Smith machine',
    category: 'Chest',
    aliases: ['decline', 'smith', 'press'],
  },
  {
    id: 'pec-deck',
    name: 'Pec Deck',
    group: 'Pec Deck',
    equipment: 'Machine',
    category: 'Chest',
    aliases: ['pec', 'machine'],
  },
  {
    id: 'chest-fly',
    name: 'Chest Fly',
    group: 'Cable Fly',
    equipment: 'Dumbbell',
    category: 'Chest',
    aliases: ['fly', 'pec'],
  },
  {
    id: 'dips',
    name: 'Dips',
    group: 'Dips',
    equipment: 'Bodyweight',
    category: 'Accessories',
    aliases: ['dip'],
  },
  {
    id: 'cable-crossover',
    name: 'Cable Crossover',
    group: 'Cable Fly',
    equipment: 'Cable',
    category: 'Chest',
    aliases: ['cable', 'fly'],
  },
  {
    id: 'push-up',
    name: 'Push-Up',
    group: 'Push-Up',
    equipment: 'Bodyweight',
    category: 'Accessories',
    aliases: ['pushup', 'press'],
  },
  {
    id: 'barbell-row',
    name: 'Barbell Row',
    group: 'Barbell Row',
    equipment: 'Barbell',
    category: 'Back',
    aliases: ['row'],
  },
  {
    id: 'lat-pulldown',
    name: 'Lat Pulldown',
    group: 'Lat Pulldown',
    equipment: 'Cable',
    category: 'Back',
    aliases: ['lat', 'pulldown'],
  },
  {
    id: 'seated-cable-row',
    name: 'Seated Cable Row',
    group: 'Seated Cable Row',
    equipment: 'Cable',
    category: 'Back',
    aliases: ['seated', 'row'],
  },
  {
    id: 'pull-up',
    name: 'Pull-Up',
    group: 'Pull-Up',
    equipment: 'Bodyweight',
    category: 'Back',
    aliases: ['pullup', 'chin'],
  },
  {
    id: 'barbell-squat',
    name: 'Barbell Squat',
    group: 'Barbell Squat',
    equipment: 'Barbell',
    category: 'Legs',
    aliases: ['squat'],
  },
  {
    id: 'romanian-deadlift',
    name: 'Romanian Deadlift',
    group: 'Romanian Deadlift',
    equipment: 'Barbell',
    category: 'Legs',
    aliases: ['rdl', 'deadlift'],
  },
];

// The current built-in catalogue is strength-only. Keeping the association on
// every item makes the type browser ready for future Mobility/Cardio/Court data
// without implying those types already have exercises.
const strengthMuscles: Record<string, Pick<ExerciseCatalogItem, 'primaryMuscle' | 'secondaryMuscles'>> = {
  'barbell-bench-press': { primaryMuscle: 'Chest', secondaryMuscles: ['Triceps', 'Front delts'] },
  'barbell-bench-press-close-grip': { primaryMuscle: 'Triceps', secondaryMuscles: ['Chest', 'Front delts'] },
  'incline-dumbbell-press': { primaryMuscle: 'Chest', secondaryMuscles: ['Triceps', 'Front delts'] },
  'incline-smith-press': { primaryMuscle: 'Chest', secondaryMuscles: ['Triceps', 'Front delts'] },
  'incline-barbell-press': { primaryMuscle: 'Chest', secondaryMuscles: ['Triceps', 'Front delts'] },
  'dumbbell-bench-press': { primaryMuscle: 'Chest', secondaryMuscles: ['Triceps', 'Front delts'] },
  'smith-bench-press': { primaryMuscle: 'Chest', secondaryMuscles: ['Triceps', 'Front delts'] },
  'decline-barbell-press': { primaryMuscle: 'Chest', secondaryMuscles: ['Triceps', 'Front delts'] },
  'decline-dumbbell-press': { primaryMuscle: 'Chest', secondaryMuscles: ['Triceps'] },
  'decline-smith-press': { primaryMuscle: 'Chest', secondaryMuscles: ['Triceps'] },
  'pec-deck': { primaryMuscle: 'Chest', secondaryMuscles: [] },
  'chest-fly': { primaryMuscle: 'Chest', secondaryMuscles: [] },
  dips: { primaryMuscle: 'Triceps', secondaryMuscles: ['Chest', 'Front delts'] },
  'cable-crossover': { primaryMuscle: 'Chest', secondaryMuscles: [] },
  'push-up': { primaryMuscle: 'Chest', secondaryMuscles: ['Triceps', 'Front delts'] },
  'barbell-row': { primaryMuscle: 'Back', secondaryMuscles: ['Biceps', 'Rear delts'] },
  'lat-pulldown': { primaryMuscle: 'Back', secondaryMuscles: ['Biceps'] },
  'seated-cable-row': { primaryMuscle: 'Back', secondaryMuscles: ['Biceps', 'Rear delts'] },
  'pull-up': { primaryMuscle: 'Back', secondaryMuscles: ['Biceps'] },
  'barbell-squat': { primaryMuscle: 'Quads', secondaryMuscles: ['Glutes', 'Hamstrings'] },
  'romanian-deadlift': { primaryMuscle: 'Hamstrings', secondaryMuscles: ['Glutes', 'Back'] },
};

export const exerciseCatalog: ExerciseCatalogItem[] = strengthCatalog.map((exercise) => ({
  ...exercise,
  ...strengthMuscles[exercise.id],
  workoutTypeIds: ['strength'],
}));
