/**
 * Kletron Design System - Shared Tailwind CSS Preset
 *
 * Single source of truth for Tailwind theme configuration.
 * Both apps/web and apps/desktop extend this preset.
 *
 * @example
 * // tailwind.config.js
 * import preset from '@kletron/ui/tailwind-preset';
 * export default { presets: [preset], content: [...] };
 */
import type { Config } from 'tailwindcss';

const preset: Partial<Config> = {
  darkMode: 'class',
  theme: {
    extend: {
      // ── Colors ───────────────────────────────────────────────────────────
      colors: {
        bg: {
          app: 'var(--bg-app)',
          surface: 'var(--bg-surface)',
          elevated: 'var(--bg-elevated)',
        },
        border: {
          subtle: 'var(--border-subtle)',
          strong: 'var(--border-strong)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        state: {
          hover: 'var(--state-hover)',
          active: 'var(--state-active)',
          selected: 'var(--state-selected)',
        },
        focusRing: 'var(--focus-ring)',

        // Semantic status colors
        status: {
          success: {
            DEFAULT: 'var(--status-success)',
            bg: 'var(--status-success-bg)',
            border: 'var(--status-success-border)',
            text: 'var(--status-success-text)',
          },
          error: {
            DEFAULT: 'var(--status-error)',
            bg: 'var(--status-error-bg)',
            border: 'var(--status-error-border)',
            text: 'var(--status-error-text)',
          },
          warning: {
            DEFAULT: 'var(--status-warning)',
            bg: 'var(--status-warning-bg)',
            border: 'var(--status-warning-border)',
            text: 'var(--status-warning-text)',
          },
          info: {
            DEFAULT: 'var(--status-info)',
            bg: 'var(--status-info-bg)',
            border: 'var(--status-info-border)',
            text: 'var(--status-info-text)',
          },
        },

        // Diff editor colors
        diff: {
          add: {
            DEFAULT: 'var(--diff-add)',
            bg: 'var(--diff-add-bg)',
            border: 'var(--diff-add-border)',
            gutter: 'var(--diff-add-gutter)',
          },
          remove: {
            DEFAULT: 'var(--diff-remove)',
            bg: 'var(--diff-remove-bg)',
            border: 'var(--diff-remove-border)',
            gutter: 'var(--diff-remove-gutter)',
          },
        },

        // Agent interaction colors
        agent: {
          thinking: {
            DEFAULT: 'var(--agent-thinking)',
            bg: 'var(--agent-thinking-bg)',
            border: 'var(--agent-thinking-border)',
            text: 'var(--agent-thinking-text)',
          },
          tool: {
            DEFAULT: 'var(--agent-tool)',
            bg: 'var(--agent-tool-bg)',
            border: 'var(--agent-tool-border)',
            text: 'var(--agent-tool-text)',
          },
          success: {
            DEFAULT: 'var(--agent-success)',
            bg: 'var(--agent-success-bg)',
            border: 'var(--agent-success-border)',
          },
          error: {
            DEFAULT: 'var(--agent-error)',
            bg: 'var(--agent-error-bg)',
            border: 'var(--agent-error-border)',
          },
          running: {
            DEFAULT: 'var(--agent-running)',
            bg: 'var(--agent-running-bg)',
            border: 'var(--agent-running-border)',
          },
          pending: {
            DEFAULT: 'var(--agent-pending)',
            bg: 'var(--agent-pending-bg)',
            border: 'var(--agent-pending-border)',
          },
        },

        // Chain status colors
        chain: {
          running: 'var(--chain-running)',
          completed: 'var(--chain-completed)',
          failed: 'var(--chain-failed)',
          paused: 'var(--chain-paused)',
        },

        // Brand colors
        brand: {
          accent: 'var(--kletron-accent)',
          accentHover: 'var(--kletron-accent-hover)',
          accentMuted: 'var(--kletron-accent-muted)',
        },

        // Glass / frosted surface colors
        glass: {
          sidebar: 'var(--glass-bg-sidebar)',
          titlebar: 'var(--glass-bg-titlebar)',
          panel: 'var(--glass-bg-panel)',
          card: 'var(--glass-bg-card)',
          cardHover: 'var(--glass-bg-card-hover)',
          input: 'var(--glass-bg-input)',
          elevated: 'var(--glass-bg-elevated)',
          border: 'var(--glass-border)',
          borderStrong: 'var(--glass-border-strong)',
        },
      },

      // ── Spacing (from design tokens) ─────────────────────────────────────
      spacing: {
        '2xs': '0.125rem',   // 2px
        xs: '0.25rem',       // 4px
        sm: '0.5rem',        // 8px
        md: '0.75rem',       // 12px
        base: '1rem',        // 16px
        lg: '1.25rem',       // 20px
        xl: '1.5rem',        // 24px
        '2xl': '2rem',       // 32px
        '3xl': '2.5rem',     // 40px
        '4xl': '3rem',       // 48px
        '5xl': '4rem',       // 64px
        '6xl': '5rem',       // 80px
        '7xl': '6rem',       // 96px
      },

      // ── Border Radius ────────────────────────────────────────────────────
      borderRadius: {
        none: '0',
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius-md)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        full: '9999px',
      },

      // ── Box Shadows ──────────────────────────────────────────────────────
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.25)',
        DEFAULT: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.25)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.25)',
        none: 'none',
      },

      // ── Font Families ────────────────────────────────────────────────────
      fontFamily: {
        display: ['"SF Pro Display"', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        body: ['"SF Pro Text"', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        mono: ['"SF Mono"', '"JetBrains Mono"', 'Menlo', 'Monaco', 'monospace'],
      },

      // ── Transition Duration (from motion tokens) ─────────────────────────
      transitionDuration: {
        fastest: '75ms',
        fast: '150ms',
        normal: '300ms',
        slow: '500ms',
        slowest: '1000ms',
      },

      // ── Transition Timing Function (from motion tokens) ──────────────────
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.4, 0, 0.2, 1)',
        'ease-out': 'cubic-bezier(0, 0, 0.2, 1)',
        'ease-in': 'cubic-bezier(0.4, 0, 1, 1)',
        'ease-in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
        bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },

      // ── Keyframes (from motion tokens) ───────────────────────────────────
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-down': {
          from: { opacity: '0', transform: 'translateY(-10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'slide-in-left': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
      },

      // ── Animation (from motion tokens) ───────────────────────────────────
      animation: {
        'fade-in': 'fade-in 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        'fade-in-up': 'fade-in-up 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        'fade-in-down': 'fade-in-down 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        'scale-in': 'scale-in 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        'slide-in-right': 'slide-in-right 300ms cubic-bezier(0, 0, 0.2, 1)',
        'slide-in-left': 'slide-in-left 300ms cubic-bezier(0, 0, 0.2, 1)',
      },
    },
  },
};

export default preset;
