import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  defaultSettingsPreferences,
  loadSettingsPreferences,
  saveSettingsPreferences,
} from '../data/settingsRepository';
import type { ChildrenProps, SettingsContextValue, SettingsPreferences } from '../types';

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: ChildrenProps) {
  const [preferences, setPreferences] = useState<SettingsPreferences>(defaultSettingsPreferences);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadSettingsPreferences()
      .then((next) => {
        if (mounted) setPreferences(next);
      })
      .finally(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const updatePreferences = useCallback((changes: Partial<SettingsPreferences>): void => {
    setPreferences((current) => {
      const next = { ...current, ...changes };
      void saveSettingsPreferences(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ ready, preferences, updatePreferences }),
    [preferences, ready, updatePreferences],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used inside SettingsProvider');
  return context;
}
