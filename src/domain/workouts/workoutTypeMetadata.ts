import type {
  IconName,
  Workout,
  WorkoutPlan,
  WorkoutRoutine,
  WorkoutTypePreference,
} from '../../types';

export const workoutTypeIconChoices = [
  { value: 'fitness-outline', label: 'Barbell' },
  { value: 'weight', label: 'Kettlebell' },
  { value: 'activity', label: 'Runner' },
  { value: 'running', label: 'Treadmill' },
  { value: 'cycling', label: 'Cycling' },
  { value: 'swimming', label: 'Swimming' },
  { value: 'walking', label: 'Walking' },
  { value: 'hiking', label: 'Hiking' },
  { value: 'stretching', label: 'Stretching' },
  { value: 'yoga', label: 'Yoga' },
  { value: 'warm-up', label: 'Gymnastics' },
  { value: 'martial-arts', label: 'Martial arts' },
  { value: 'jump-rope', label: 'Jump rope' },
  { value: 'tennis-ball', label: 'Tennis ball' },
  { value: 'basketball', label: 'Football' },
  { value: 'basketball-ball', label: 'Basketball' },
  { value: 'volleyball', label: 'Volleyball' },
  { value: 'baseball', label: 'Baseball' },
  { value: 'golf', label: 'Golf' },
  { value: 'table-tennis', label: 'Table tennis' },
  { value: 'skiing', label: 'Ski jumping' },
  { value: 'skateboarding', label: 'Skateboarding' },
  { value: 'task-list', label: 'Checklist' },
  { value: 'heart', label: 'Heartbeat' },
  { value: 'recovery', label: 'Recovery' },
  { value: 'stopwatch', label: 'Stopwatch' },
  { value: 'shoe', label: 'Shoe' },
  { value: 'layers', label: 'Layers' },
] as const satisfies readonly { value: IconName; label: string }[];

const defaultIcons: Record<string, IconName> = {
  strength: 'fitness-outline',
  calisthenics: 'activity',
  mobility: 'stretching',
  cardio: 'running',
  functional: 'task-list',
  'olympic-weightlifting': 'weight',
  plyometrics: 'activity',
  'court-sport': 'tennis-ball',
  'field-sport': 'basketball',
  'martial-arts': 'warm-up',
};

export function isWorkoutTypeIcon(value: unknown): value is IconName {
  return workoutTypeIconChoices.some((choice) => choice.value === value);
}

export function matchesWorkoutType(value: string, type: WorkoutTypePreference): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === type.id.trim().toLowerCase() || normalized === type.name.trim().toLowerCase()
  );
}

export function defaultWorkoutTypeIcon(value: string): IconName {
  return defaultIcons[value.trim().toLowerCase().replace(/\s+/g, '-')] ?? 'fitness-outline';
}

export function workoutTypeIcon(type: WorkoutTypePreference): IconName {
  return isWorkoutTypeIcon(type.icon) ? type.icon : defaultWorkoutTypeIcon(type.id);
}

export function resolveWorkoutTypeIcon(
  value: string | undefined,
  types: readonly WorkoutTypePreference[],
): IconName {
  const preference = types.find((type) => matchesWorkoutType(value ?? '', type));
  return preference ? workoutTypeIcon(preference) : defaultWorkoutTypeIcon(value ?? '');
}

export function workoutTypeUsage(
  type: WorkoutTypePreference,
  workouts: readonly Workout[],
  plans: readonly WorkoutPlan[],
  standaloneRoutines: readonly WorkoutRoutine[],
) {
  return {
    workouts: workouts
      .filter((workout) => workout.completedAt !== null && matchesWorkoutType(workout.type, type))
      .sort(
        (left, right) =>
          (right.completedAt ?? right.startedAt) - (left.completedAt ?? left.startedAt),
      ),
    routines: [
      ...standaloneRoutines
        .filter((routine) => matchesWorkoutType(routine.type, type))
        .map((routine) => ({ routine, planName: undefined as string | undefined })),
      ...plans.flatMap((plan) =>
        plan.routines
          .filter((routine) => matchesWorkoutType(routine.type, type))
          .map((routine) => ({ routine, planName: plan.name })),
      ),
    ],
  };
}
