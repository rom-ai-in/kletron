/**
 * Numezis Design System - Border Radius Tokens
 * 
 * Consistent corner radii across the application.
 * Matches CSS variables and Tailwind config.
 * 
 * @example
 * import { radius } from '@numezis/ui/tokens';
 * <div style={{ borderRadius: radius.md }} />
 * 
 * // Prefer Tailwind classes
 * <div className="rounded-md" />
 */

// =============================================================================
// RADIUS SCALE
// =============================================================================

export const radius = {
    /** 0px - Sharp corners */
    none: '0',
    /** 2px - Subtle rounding (badges, small buttons) */
    sm: 'var(--radius-sm)',
    /** 6px - Default for buttons, inputs */
    md: 'var(--radius-md)',
    /** 8px - Cards, panels */
    lg: 'var(--radius-lg)',
    /** 12px - Modals, large containers */
    xl: 'var(--radius-xl)',
    /** 9999px - Fully rounded (pills, avatars) */
    full: '9999px',
} as const;

// =============================================================================
// RAW VALUES (for contexts without CSS var support)
// =============================================================================

export const rawRadius = {
    none: '0',
    sm: '0.125rem',  // 2px
    md: '0.375rem',  // 6px
    lg: '0.5rem',    // 8px
    xl: '0.75rem',   // 12px
    full: '9999px',
} as const;

// =============================================================================
// SEMANTIC RADIUS (Component-specific)
// =============================================================================

export const componentRadius = {
    /** Button corners - 6px */
    button: radius.md,
    /** Input/form field corners - 6px */
    input: radius.md,
    /** Badge/chip corners - 6px (or full for pills) */
    badge: radius.md,
    badgePill: radius.full,
    /** Card corners - 8px */
    card: radius.lg,
    /** Panel corners - 8px */
    panel: radius.lg,
    /** Modal corners - 12px */
    modal: radius.xl,
    /** Avatar - fully rounded */
    avatar: radius.full,
    /** Tooltip - 6px */
    tooltip: radius.md,
    /** Dropdown menu - 8px */
    dropdown: radius.lg,
} as const;

// Type exports
export type RadiusToken = keyof typeof radius;
