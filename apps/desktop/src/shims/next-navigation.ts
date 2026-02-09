/**
 * Shim for "next/navigation" in the Electron/Vite desktop app.
 * Provides lightweight browser-based equivalents.
 */
import { useState, useEffect, useCallback, useMemo } from "react";

// ─── usePathname ─────────────────────────────────────────────────────────────
export function usePathname(): string {
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const onPop = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return pathname;
}

// ─── useRouter ───────────────────────────────────────────────────────────────
export interface AppRouterInstance {
  push: (url: string) => void;
  replace: (url: string) => void;
  back: () => void;
  forward: () => void;
  refresh: () => void;
  prefetch: (url: string) => void;
}

export function useRouter(): AppRouterInstance {
  return useMemo<AppRouterInstance>(
    () => ({
      push: (url: string) => {
        window.history.pushState(null, "", url);
        window.dispatchEvent(new PopStateEvent("popstate"));
      },
      replace: (url: string) => {
        window.history.replaceState(null, "", url);
        window.dispatchEvent(new PopStateEvent("popstate"));
      },
      back: () => window.history.back(),
      forward: () => window.history.forward(),
      refresh: () => window.location.reload(),
      prefetch: () => {
        /* noop in desktop */
      },
    }),
    []
  );
}

// ─── useParams ───────────────────────────────────────────────────────────────
export function useParams(): Record<string, string | string[]> {
  // In the desktop app there is no Next.js dynamic routing, so return empty.
  return {};
}

// ─── useSearchParams ─────────────────────────────────────────────────────────
export function useSearchParams() {
  const [params, setParams] = useState(
    () => new URLSearchParams(window.location.search)
  );

  useEffect(() => {
    const onPop = () =>
      setParams(new URLSearchParams(window.location.search));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return params;
}

// ─── redirect / notFound (server-only in Next.js, noop here) ─────────────────
export function redirect(url: string): never {
  window.location.href = url;
  throw new Error("NEXT_REDIRECT");
}

export function notFound(): never {
  throw new Error("NEXT_NOT_FOUND");
}
