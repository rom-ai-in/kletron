'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type AppHeaderCenterContextValue = {
  centerContent: React.ReactNode | null;
  setCenterContent: (node: React.ReactNode | null) => void;
};

const AppHeaderCenterContext = createContext<AppHeaderCenterContextValue | null>(null);

export function AppHeaderCenterProvider({ children }: { children: React.ReactNode }) {
  const [centerContent, setCenterContentState] = useState<React.ReactNode | null>(null);
  const setCenterContent = useCallback((node: React.ReactNode | null) => {
    setCenterContentState(node);
  }, []);

  const value = useMemo(
    () => ({ centerContent, setCenterContent }),
    [centerContent, setCenterContent],
  );

  return (
    <AppHeaderCenterContext.Provider value={value}>{children}</AppHeaderCenterContext.Provider>
  );
}

export function useAppHeaderCenter() {
  const ctx = useContext(AppHeaderCenterContext);
  if (!ctx) {
    throw new Error('useAppHeaderCenter must be used within AppHeaderCenterProvider');
  }
  return ctx;
}

export function useOptionalAppHeaderCenter() {
  return useContext(AppHeaderCenterContext);
}
