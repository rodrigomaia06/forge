import { formatDuration, measurementText, parseDuration, updateMeasurement } from '../exercises/tracking';
import type { SetMeasurementKind, WorkoutSet } from '../../types';

const RANGE_SEPARATOR = /[-–—]/;

/**
 * Cleans a routine interval while it is typed: digits, one range separator and,
 * per side, one decimal separator (kept as typed) or, for time, clock colons.
 * A decimal keypad's `.`/`,` act as the clock separator for time, matching
 * recorded time entry.
 */
export function rangeEntryText(value: string, kind: SetMeasurementKind): string {
  const time = kind === 'duration';
  let separatorFound = false;
  let decimalFound = false;
  let result = '';
  for (const character of value) {
    if (/\d/.test(character)) {
      result += character;
    } else if (RANGE_SEPARATOR.test(character)) {
      if (separatorFound) continue;
      separatorFound = true;
      decimalFound = false;
      result += '-';
    } else if (time && (character === ':' || character === '.' || character === ',')) {
      result += ':';
    } else if (!time && (character === '.' || character === ',') && !decimalFound) {
      decimalFound = true;
      result += character;
    }
  }
  return result;
}

/** Parses a routine interval into its finite bounds (one or two values). */
export function rangeEntryValues(text: string, kind: SetMeasurementKind): number[] {
  const time = kind === 'duration';
  return text
    .split(RANGE_SEPARATOR)
    .map((part) => (time ? part.replace(/[,.]/g, ':') : part.replace(',', '.')).trim())
    // `Number('')` is zero. Ignore empty sides so clearing a routine range
    // removes its planned target instead of silently replacing it with `0`.
    .filter((part) => part.length > 0)
    .map((part) => (time ? parseDuration(part) : Number(part)))
    .filter(Number.isFinite)
    .slice(0, 2);
}

/** Display text for an interval: time as mm:ss (hh:mm:ss), ranges with an en dash. */
export function formatRangeEntry(
  kind: SetMeasurementKind,
  minValue: number,
  maxValue?: number,
): string {
  const format = (value: number) => (kind === 'duration' ? formatDuration(value) : String(value));
  return maxValue !== undefined && maxValue !== minValue
    ? `${format(minValue)}–${format(maxValue)}`
    : format(minValue);
}

/**
 * A routine set's recorded value shown as its interval. Routines normally hold
 * planned intervals, but imported routines can store actual measurements; the
 * editor shows them instead of an empty box.
 */
export function recordedIntervalText(set: WorkoutSet, kind: SetMeasurementKind): string {
  const text = measurementText(set, kind).trim();
  const value = Number(text.replace(',', '.'));
  return text && Number.isFinite(value) ? formatRangeEntry(kind, value) : '';
}

/**
 * Editing a routine interval replaces a recorded value of the same field, so
 * clearing the interval empties the box instead of resurfacing that value.
 */
export function withoutRecordedInterval(
  set: WorkoutSet,
  kind: SetMeasurementKind,
): Partial<Pick<WorkoutSet, 'measurements' | 'reps'>> {
  if (!recordedIntervalText(set, kind)) return {};
  return { measurements: updateMeasurement(set, kind, ''), ...(kind === 'reps' ? { reps: '' } : {}) };
}
