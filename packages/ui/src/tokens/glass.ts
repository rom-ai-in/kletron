/**
 * Kletron Design System - Glass / Frosted Surface Tokens
 *
 * Semi-transparent surfaces for macOS vibrancy and CSS backdrop-filter.
 * Use the corresponding CSS variables via Tailwind classes (e.g. `bg-glass-sidebar`)
 * or apply the `.glass-*` utility classes directly.
 */

// ── Glass background surfaces ────────────────────────────────────────────────
export const glassSurfaces = {
  /** Sidebar panels — 52% opaque dark zinc */
  sidebar: 'var(--glass-bg-sidebar)',
  /** Title bar / tab bar — 42% opaque */
  titlebar: 'var(--glass-bg-titlebar)',
  /** General panels — 55% opaque */
  panel: 'var(--glass-bg-panel)',
  /** Cards — subtle white overlay */
  card: 'var(--glass-bg-card)',
  /** Card hover state */
  cardHover: 'var(--glass-bg-card-hover)',
  /** Input fields — subtle recessed look */
  input: 'var(--glass-bg-input)',
  /** Modals, popovers, dropdowns — 60% opaque elevated */
  elevated: 'var(--glass-bg-elevated)',
} as const;

// ── Glass borders ────────────────────────────────────────────────────────────
export const glassBorders = {
  /** Standard glass edge — 12% white */
  DEFAULT: 'var(--glass-border)',
  /** Stronger glass edge — 20% white */
  strong: 'var(--glass-border-strong)',
} as const;

// ── Blur radii ───────────────────────────────────────────────────────────────
export const glassBlur = {
  sm: 'var(--glass-blur-sm)',
  md: 'var(--glass-blur-md)',
  lg: 'var(--glass-blur-lg)',
  xl: 'var(--glass-blur-xl)',
} as const;

export const glass = {
  surfaces: glassSurfaces,
  borders: glassBorders,
  blur: glassBlur,
} as const;
