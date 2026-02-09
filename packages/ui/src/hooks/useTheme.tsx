'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

// =============================================================================
// TYPES
// =============================================================================

type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
    /** The user's chosen theme preference */
    theme: Theme;
    /** The resolved theme after evaluating system preference */
    resolvedTheme: ResolvedTheme;
    /** Update the theme preference (persists to localStorage) */
    setTheme: (theme: Theme) => void;
}

// =============================================================================
// CONTEXT
// =============================================================================

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// =============================================================================
// PROVIDER
// =============================================================================

export interface ThemeProviderProps {
    children: ReactNode;
    /** Default theme if nothing is stored. Defaults to 'dark'. */
    defaultTheme?: Theme;
    /** localStorage key for persistence. Defaults to 'numezis-theme'. */
    storageKey?: string;
}

export function ThemeProvider({
    children,
    defaultTheme = 'dark',
    storageKey = 'numezis-theme',
}: ThemeProviderProps) {
    const [theme, setThemeState] = useState<Theme>(defaultTheme);
    const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(
        defaultTheme === 'system' ? 'dark' : defaultTheme === 'light' ? 'light' : 'dark'
    );

    // Read persisted preference on mount (client only)
    useEffect(() => {
        try {
            const stored = localStorage.getItem(storageKey) as Theme | null;
            if (stored && ['light', 'dark', 'system'].includes(stored)) {
                setThemeState(stored);
            }
        } catch {
            // localStorage may not be available (SSR, privacy mode)
        }
    }, [storageKey]);

    // Resolve system preference and apply to DOM
    useEffect(() => {
        const resolve = (): ResolvedTheme => {
            if (theme === 'system') {
                return window.matchMedia('(prefers-color-scheme: dark)').matches
                    ? 'dark'
                    : 'light';
            }
            return theme;
        };

        const resolved = resolve();
        setResolvedTheme(resolved);

        // Apply class to <html> for Tailwind dark mode
        const root = document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(resolved);

        // Listen for system preference changes when in 'system' mode
        if (theme === 'system') {
            const mq = window.matchMedia('(prefers-color-scheme: dark)');
            const handler = (e: MediaQueryListEvent) => {
                const newResolved = e.matches ? 'dark' : 'light';
                setResolvedTheme(newResolved);
                root.classList.remove('light', 'dark');
                root.classList.add(newResolved);
            };
            mq.addEventListener('change', handler);
            return () => mq.removeEventListener('change', handler);
        }
    }, [theme]);

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
        try {
            localStorage.setItem(storageKey, newTheme);
        } catch {
            // Silently fail if localStorage is unavailable
        }
    };

    return (
        <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

// =============================================================================
// HOOK
// =============================================================================

export function useTheme(): ThemeContextValue {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
        throw new Error('useTheme must be used within a <ThemeProvider>');
    }
    return ctx;
}

/**
 * SSR flash-prevention script (inline in <head>).
 * Synchronously sets the theme class before React hydration.
 *
 * Usage in Next.js layout.tsx:
 * <script dangerouslySetInnerHTML={{ __html: themeScript }} />
 */
export const themeScript = `(function(){try{var t=localStorage.getItem('numezis-theme')||'dark';var r=t==='system'?(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'):t;document.documentElement.classList.add(r)}catch(e){}})();`;
