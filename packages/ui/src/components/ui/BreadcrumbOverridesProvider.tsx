"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type BreadcrumbOverridesContextValue = {
  labelsByHref: Record<string, string>;
  setLabel: (href: string, label: string) => void;
  clearLabel: (href: string) => void;
};

const BreadcrumbOverridesContext = createContext<BreadcrumbOverridesContextValue | null>(null);

export function BreadcrumbOverridesProvider({ children }: { children: React.ReactNode }) {
  const [labelsByHref, setLabelsByHref] = useState<Record<string, string>>({});

  const setLabel = useCallback((href: string, label: string) => {
    setLabelsByHref((prev) => {
      if (prev[href] === label) return prev;
      return { ...prev, [href]: label };
    });
  }, []);

  const clearLabel = useCallback((href: string) => {
    setLabelsByHref((prev) => {
      if (!(href in prev)) return prev;
      const { [href]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const value = useMemo(() => ({ labelsByHref, setLabel, clearLabel }), [labelsByHref, setLabel, clearLabel]);

  return (
    <BreadcrumbOverridesContext.Provider value={value}>
      {children}
    </BreadcrumbOverridesContext.Provider>
  );
}

export function useBreadcrumbOverrides() {
  const ctx = useContext(BreadcrumbOverridesContext);
  if (!ctx) {
    throw new Error("useBreadcrumbOverrides must be used within BreadcrumbOverridesProvider");
  }
  return ctx;
}

/**
 * Set (and automatically clean up) a breadcrumb label override for a given href.
 * Useful for dynamic detail pages where the label comes from fetched data.
 */
export function useBreadcrumbLabelOverride(href: string, label: string | null | undefined) {
  const { setLabel, clearLabel } = useBreadcrumbOverrides();

  useEffect(() => {
    if (!label) return;
    setLabel(href, label);
    return () => clearLabel(href);
  }, [href, label, setLabel, clearLabel]);
}

