import type { Workout, TrackingType } from '../../types';
import type { ExerciseCatalogItem } from '../exerciseCatalog';

export type CsvSource = 'hevy' | 'strong' | 'fitnotes' | 'fitnotes-ios';
export const sourceLabels: Record<CsvSource, string> = {
  hevy: 'Hevy',
  strong: 'Strong',
  fitnotes: 'FitNotes Android',
  'fitnotes-ios': 'FitNotes iOS',
};
export interface CsvOptions {
  dateOrder?: 'day-first' | 'month-first';
  weightUnit?: 'kg' | 'lb';
  distanceUnit?: 'km' | 'mi';
}
export interface CsvIssue {
  row: number;
  field: string;
  message: string;
  sessionKey?: string;
}
export interface CsvDraft {
  source: CsvSource;
  workouts: Workout[];
  issues: CsvIssue[];
  excluded: number;
  requirements: Array<'dateOrder' | 'weightUnit' | 'distanceUnit'>;
  limitations: string[];
}
export interface ExerciseResolution {
  key: string;
  name: string;
  trackingType: TrackingType;
  exercise?: ExerciseCatalogItem;
  custom?: boolean;
  remembered?: boolean;
}
export type CsvMappings = Record<string, string>;
export type SessionChoice = 'keep' | 'replace' | 'both';
export interface CsvSessionMatch {
  workout: Workout;
  status: 'new' | 'duplicate' | 'changed' | 'ambiguous';
  existing?: Workout;
}
export interface CsvImportRequest {
  draft: CsvDraft;
  selected: string[];
  resolutions: ExerciseResolution[];
  choices: Record<string, SessionChoice>;
  /** Review must still describe the records being replaced at commit time. */
  reviewed: Record<string, string>;
  acknowledged: boolean;
}
export interface CsvImportResult {
  added: number;
  replaced: number;
  duplicates: number;
  excluded: number;
  customExercises: number;
}
