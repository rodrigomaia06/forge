import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type DashboardTileKind = 'start' | 'week' | 'training-time' | 'last-workout' | 'volume';

export interface DashboardTileConfig {
  kind: DashboardTileKind;
  visible: boolean;
  /** Custom title override; falls back to the tile's default when absent. */
  title?: string;
}

const STORAGE_KEY = '@forge/dashboard-layout-v1';

export const DASHBOARD_TILE_ORDER: DashboardTileKind[] = [
  'start',
  'week',
  'training-time',
  'last-workout',
  'volume',
];

export const DASHBOARD_TILE_DEFAULT_TITLE: Record<DashboardTileKind, string> = {
  start: 'Start workout',
  week: 'This week',
  'training-time': 'Training time',
  'last-workout': 'Last workout',
  volume: 'Training volume',
};

export function defaultDashboardLayout(): DashboardTileConfig[] {
  return DASHBOARD_TILE_ORDER.map((kind) => ({ kind, visible: true }));
}

/**
 * Reconciles a persisted layout with the known tile set: keeps the saved order
 * and per-tile settings, drops unknown kinds, and appends any tile kind added
 * since the layout was saved so new tiles still surface.
 */
export function reconcileLayout(saved: unknown): DashboardTileConfig[] {
  const known = new Set(DASHBOARD_TILE_ORDER);
  const seen = new Set<DashboardTileKind>();
  const result: DashboardTileConfig[] = [];
  if (Array.isArray(saved)) {
    for (const entry of saved) {
      const kind = (entry as DashboardTileConfig)?.kind;
      if (!known.has(kind) || seen.has(kind)) continue;
      seen.add(kind);
      result.push({
        kind,
        visible: (entry as DashboardTileConfig).visible !== false,
        title: typeof (entry as DashboardTileConfig).title === 'string' && (entry as DashboardTileConfig).title!.trim()
          ? (entry as DashboardTileConfig).title
          : undefined,
      });
    }
  }
  for (const kind of DASHBOARD_TILE_ORDER) {
    if (!seen.has(kind)) result.push({ kind, visible: true });
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
