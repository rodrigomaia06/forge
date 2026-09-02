import React, { createContext, useContext } from 'react';

interface PrimaryDockContextValue {
  compact: boolean;
  setCompact: (compact: boolean) => void;
}

const PrimaryDockContext = createContext<PrimaryDockContextValue | null>(null);

export const PrimaryDockProvider = PrimaryDockContext.Provider;

export function usePrimaryDock(): PrimaryDockContextValue {
  const value = useContext(PrimaryDockContext);
  if (!value) throw new Error('usePrimaryDock must be used inside MainTabNavigator.');
  return value;
}
