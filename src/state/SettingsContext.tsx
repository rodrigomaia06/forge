import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  defaultSettingsPreferences,
  loadSettingsPreferences,
  saveSettingsPreferences,
} from '../data/settingsRepository';
import type { ChildrenProps, SettingsContextValue, SettingsPreferences } from '../types';

import { registerPersistenceFlush } from '../data/persistenceLifecycle';

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: ChildrenProps) {
  const [preferences, setPreferences] = useState<SettingsPreferences>(defaultSettingsPreferences);
  const currentPreferences = React.useRef(preferences);
  const saveQueue = React.useRef(Promise.resolve());
  const [ready, setReady] = useState(false);

  const reload = useCallback(async (): Promise<void> => {
    const next = await loadSettingsPreferences();
    currentPreferences.current = next;
    setPreferences(next);
    setReady(true);
  }, []);
  useEffect(() => {
    let mounted = true;
    loadSettingsPreferences()
      .then((next) => {
        if (mounted) { currentPreferences.current = next; setPreferences(next); }
      })
      .finally(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => registerPersistenceFlush(() => saveQueue.current), []);

  const updatePreferences = useCallback((changes: Partial<SettingsPreferences>): Promise<boolean> => {
    const save = saveQueue.current.then(async () => {
      const next = { ...currentPreferences.current, ...changes };
      try {
        await saveSettingsPreferences(next);
        currentPreferences.current = next;
        setPreferences(next);
        return true;
      } catch {
        return false;
      }
    });
    saveQueue.current = save.then(() => undefined);
    return save;
  }, []);

  const value = useMemo(
    () => ({ ready, preferences, updatePreferences, reload }),
    [preferences, ready, updatePreferences, reload],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used inside SettingsProvider');
  return context;
}
