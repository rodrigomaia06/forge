import { useCallback, useEffect, useReducer, useRef, type SetStateAction } from 'react';
import type { TrackingType, Workout } from '../types';
import {
  applyLiveTrackingChange,
  type TrackingChangeResult,
} from '../domain/exercises/trackingChanges';
import { makeWorkoutId } from './workoutMutations';
import { effectiveTracking } from '../domain/exercises/tracking';

export interface ActiveWorkoutState {
  workout: Workout | null;
  receipt?: { id: string; result: TrackingChangeResult };
}
type Action =
  | { kind: 'update'; update: SetStateAction<Workout | null> }
  | {
      kind: 'tracking';
      id: string;
      blockId: string;
      mode: TrackingType;
      confirmed: boolean;
      ids: string[];
      history: Workout[];
    };

export function reduceActiveWorkout(state: ActiveWorkoutState, action: Action): ActiveWorkoutState {
  if (action.kind === 'update') {
    return {
      ...state,
      workout: typeof action.update === 'function' ? action.update(state.workout) : action.update,
    };
  }
  try {
    const { workout, result } = applyLiveTrackingChange(
      state.workout,
      action.blockId,
      action.mode,
      action.confirmed,
      action.ids,
      action.history,
    );
    return { workout, receipt: { id: action.id, result } };
  } catch {
    return { ...state, receipt: { id: action.id, result: { status: 'failed' } } };
  }
}

export function useActiveWorkoutState() {
  const [state, dispatch] = useReducer(reduceActiveWorkout, { workout: null });
  const pending = useRef<{
    id: string;
    promise: Promise<TrackingChangeResult>;
    resolve: (result: TrackingChangeResult) => void;
  } | null>(null);
  const setWorkout = useCallback((update: SetStateAction<Workout | null>) => {
    dispatch({ kind: 'update', update });
  }, []);
  const requestTrackingChange = useCallback(
    (blockId: string, mode: TrackingType, confirmed: boolean, history: Workout[]) => {
      if (pending.current) return pending.current.promise;
      const id = makeWorkoutId('tracking-request');
      let resolve!: (result: TrackingChangeResult) => void;
      const promise = new Promise<TrackingChangeResult>((complete) => {
        resolve = complete;
      });
      pending.current = { id, promise, resolve };
      // Allocate outside the reducer so Strict Mode replay produces identical IDs.
      const ids = Array.from({ length: 3 }, () => makeWorkoutId('tracking'));
      dispatch({ kind: 'tracking', id, blockId, mode, confirmed, ids, history });
      return promise;
    },
    [],
  );
  useEffect(() => {
    if (!pending.current || pending.current.id !== state.receipt?.id) return;
    const request = pending.current;
    pending.current = null;
    const result = state.receipt.result;
    if (result.status === 'applied' || result.status === 'unchanged') {
      const block = state.workout?.exercises.find((exercise) => exercise.id === result.blockId);
      request.resolve(
        !block
          ? { status: 'missing' }
          : effectiveTracking(block) !== result.mode
            ? { status: 'failed' }
            : result,
      );
    } else request.resolve(result);
  }, [state]);
  useEffect(
    () => () => {
      pending.current?.resolve({ status: 'missing' });
      pending.current = null;
    },
    [],
  );
  return [state.workout, setWorkout, requestTrackingChange] as const;
}
