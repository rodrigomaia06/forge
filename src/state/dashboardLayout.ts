import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type DashboardTileKind =
  | 'start'
  | 'week'
  | 'training-time'
  | 'last-workout'
  | 'volume'
  | 'rest-stats'
  | 'muscle-balance'
  | 'consistency'
  | 'streak'
  | 'muscle-heatmap'
  | 'measurement'
  | 'measurements'
  | 'note'
  | 'calendar';

/** Per-tile configuration edited from the tile's edit-mode gear. */
export interface DashboardTileSettings {
  /** Trend/aggregation window in days (rest, heatmap). */
  windowDays?: number;
  /** Aggregation window in weeks (muscle balance, consistency, streak). */
  windowWeeks?: number;
  /** Streak: workouts-per-week target per workout-type id (plus a default). */
  weeklyTargetDefault?: number;
  weeklyTargets?: Record<string, number>;
  /** Measurement tile: which daily measurement definition it shows. */
  measurementId?: string;
  /** Combined measurements tile: which definitions it charts together. */
  measurementIds?: string[];
  /** Muscle balance: individual-muscle slugs to show; empty = the six groups. */
  muscleFilter?: string[];
  /** Note tile: the free-text body the user types. */
  noteText?: string;
  /** Muscle heatmap: which body model to draw. */
  gender?: 'male' | 'female';
}

/** Singleton cards that are addable from the chooser but hidden until added. */
export const OPTIONAL_SINGLETON_KINDS: DashboardTileKind[] = ['note', 'calendar'];

export interface DashboardTileConfig {
  /** Stable per-instance id. Built-ins use their kind; measurement tiles use
   * `measurement:<definitionId>` so several can coexist. */
  id: string;
  kind: DashboardTileKind;
  visible: boolean;
  /** Custom title override; falls back to the tile's default when absent. */
  title?: string;
  /** Card-specific configuration; absent means "use the tile's defaults". */
  settings?: DashboardTileSettings;
}

export const MEASUREMENT_TILE_PREFIX = 'measurement:';
/** Combined measurements cards are per-instance so several can coexist. */
export const MEASUREMENTS_TILE_PREFIX = 'measurements:';
export function newMeasurementsTileId(): string {
  return `${MEASUREMENTS_TILE_PREFIX}${Date.now().toString(36)}`;
}
export function measurementTileId(definitionId: string): string {
  return `${MEASUREMENT_TILE_PREFIX}${definitionId}`;
}

const STORAGE_KEY = '@forge/dashboard-layout-v1';

export const DASHBOARD_TILE_ORDER: DashboardTileKind[] = [
  'start',
  'week',
  'training-time',
  'last-workout',
  'volume',
  'rest-stats',
  'muscle-balance',
  'consistency',
  'streak',
  'muscle-heatmap',
];

export const DASHBOARD_TILE_DEFAULT_TITLE: Record<DashboardTileKind, string> = {
  // Not "Start workout": that phrase is the header action's accessible name, and
  // the tile's reorder/remove labels embed this title.
  start: 'Suggested workout',
  week: 'This week',
  'training-time': 'Training time',
  'last-workout': 'Last workout',
  volume: 'Training volume',
  'rest-stats': 'Rest timer',
  'muscle-balance': 'Muscle balance',
  consistency: 'Consistency',
  streak: 'Streak',
  'muscle-heatmap': 'Muscle heatmap',
  measurement: 'Measurement',
  measurements: 'Measurements',
  note: 'Note',
  calendar: 'Calendar',
};

/** Default settings a tile starts with, and the domain of what its gear edits. */
export const DASHBOARD_TILE_DEFAULT_SETTINGS: Partial<Record<DashboardTileKind, DashboardTileSettings>> = {
  volume: { windowWeeks: 12 },
  'rest-stats': { windowDays: 30 },
  'muscle-balance': { windowWeeks: 4 },
  consistency: { windowWeeks: 16 },
  streak: { weeklyTargetDefault: 3, weeklyTargets: {} },
  'muscle-heatmap': { windowDays: 30 },
  measurement: { windowDays: 90 },
  measurements: { windowDays: 90, measurementIds: [] },
};

/** Which tiles expose an edit-mode gear (and therefore a settings sheet). */
export function tileHasSettings(kind: DashboardTileKind): boolean {
  return Boolean(DASHBOARD_TILE_DEFAULT_SETTINGS[kind]);
}

/** Merges a tile's saved settings over its defaults. */
export function tileSettings(config: DashboardTileConfig): DashboardTileSettings {
  return { ...(DASHBOARD_TILE_DEFAULT_SETTINGS[config.kind] ?? {}), ...(config.settings ?? {}) };
}

export function defaultDashboardLayout(): DashboardTileConfig[] {
  return DASHBOARD_TILE_ORDER.map((kind) => ({ id: kind, kind, visible: true }));
}

/**
 * Reconciles a persisted layout with the known tile set: keeps the saved order
 * and per-tile settings, drops unknown kinds, and appends any tile kind added
 * since the layout was saved so new tiles still surface.
 */
export function reconcileLayout(saved: unknown): DashboardTileConfig[] {
  const known = new Set(DASHBOARD_TILE_ORDER);
  const seen = new Set<string>();
  const result: DashboardTileConfig[] = [];
  if (Array.isArray(saved)) {
    for (const raw of saved) {
      const entry = raw as DashboardTileConfig;
      const kind = entry?.kind;
      const isMeasurement = kind === 'measurement';
      const isMeasurements = kind === 'measurements';
      const isOptionalSingleton = OPTIONAL_SINGLETON_KINDS.includes(kind);
      // Measurement(s) tiles are keyed per instance; built-ins/singletons by kind.
      const id = typeof entry?.id === 'string' && entry.id ? entry.id : kind;
      if (isMeasurement) {
        if (typeof id !== 'string' || !id.startsWith(MEASUREMENT_TILE_PREFIX) || !entry.settings?.measurementId || seen.has(id)) continue;
      } else if (isMeasurements) {
        // Any combined-measurements instance (legacy `measurements` id or
        // `measurements:<n>`), kept if present; never auto-appended.
        if (typeof id !== 'string' || !id || seen.has(id)) continue;
      } else if (isOptionalSingleton) {
        // Kept only if present in the saved layout; never auto-appended.
        if (seen.has(id)) continue;
      } else if (!known.has(kind) || seen.has(id)) {
        continue;
      }
      seen.add(id);
      const settings = entry.settings;
      result.push({
        id: id as string,
        kind,
        visible: entry.visible !== false,
        title: typeof entry.title === 'string' && entry.title.trim() ? entry.title : undefined,
        settings: settings && typeof settings === 'object' ? settings : undefined,
      });
    }
  }
  for (const kind of DASHBOARD_TILE_ORDER) {
    if (!seen.has(kind)) result.push({ id: kind, kind, visible: true });
  }
  return result;
}

export function useDashboardLayout(): {
  layout: DashboardTileConfig[];
  ready: boolean;
  setLayout: (next: DashboardTileConfig[]) => void;
} {
  const [layout, setLayoutState] = useState<DashboardTileConfig[]>(defaultDashboardLayout);
  const [ready, setReady] = useState(false);
  const hydratedRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (!mounted) return;
        if (value) {
          try {
            setLayoutState(reconcileLayout(JSON.parse(value)));
          } catch {
            /* keep defaults */
          }
        }
      })
      .finally(() => {
        if (mounted) {
          hydratedRef.current = true;
          setReady(true);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const setLayout = useCallback((next: DashboardTileConfig[]) => {
    setLayoutState(next);
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  return { layout, ready, setLayout };
}
