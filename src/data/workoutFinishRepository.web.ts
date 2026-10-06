import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FinishRoutineChoice, Workout } from '../types';
import { queueWebWrite } from './webWriteQueue';
import { writeWebWorkoutFinish } from './webWorkoutFinish';
export function persistWorkoutFinish(workout: Workout, choice: FinishRoutineChoice): Promise<Workout> {
  return queueWebWrite(() => writeWebWorkoutFinish(AsyncStorage, workout, choice));
}
