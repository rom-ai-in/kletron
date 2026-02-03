/**
 * Numezis Design System - Shadow Tokens
 * 
 * Box shadow definitions for elevation hierarchy.
 * Matches Tailwind config shadows.
 * 
 * @example
 * import { shadows } from '@/src/tokens';
 * <div style={{ boxShadow: shadows.md }} />
 * 
 * // Prefer Tailwind classes
 * <div className="shadow-md" />
 */

// =============================================================================
// SHADOW SCALE
// =============================================================================

export const shadows = {
    /** No shadow */
    none: 'none',
    /** Subtle shadow for inline elements */
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.25)',
    /** Default shadow for cards, buttons */
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
    /** Large shadow for dropdowns, popovers */
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.25)',
    /** Extra large shadow for modals */
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.25)',
    /** 2XL shadow for floating elements */
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    /** Inner shadow for pressed states */
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.2)',
} as const;

// =============================================================================
// GLOW EFFECTS
// =============================================================================

export const glows = {
    /** Primary accent glow */
    primary: '0 0 30px rgba(14, 165, 233, 0.3), 0 0 60px rgba(99, 102, 241, 0.15)',
    /** EU blue glow */
    eu: '0 0 30px rgba(37, 99, 235, 0.25), 0 0 60px rgba(37, 99, 235, 0.1)',
    /** Numezis brand glow */
    brand: '0 0 20px rgba(57, 148, 188, 0.4)',
    /** Success glow */
    success: '0 0 20px rgba(34, 197, 94, 0.3)',
    /** Error glow */
    error: '0 0 20px rgba(244, 63, 94, 0.3)',
    /** Violet thinking glow */
    thinking: '0 0 20px rgba(139, 92, 246, 0.3)',
} as const;

// =============================================================================
// SEMANTIC SHADOWS
// =============================================================================

export const componentShadows = {
    /** Cards - subtle elevation */
    card: shadows.sm,
    /** Dropdowns, popovers - medium elevation */
    dropdown: shadows.lg,
    /** Modals - high elevation */
    modal: shadows.xl,
    /** Tooltip - subtle */
    tooltip: shadows.md,
    /** Button hover - slight lift */
    buttonHover: '0 4px 12px rgba(0, 0, 0, 0.3)',
    /** Focus ring - uses accent glow */
    focus: '0 0 0 3px var(--focus-ring)',
    /** Glass panel - frosted effect */
    glass: '0 8px 32px rgba(0, 0, 0, 0.4)',
} as const;

// Type exports
export type Shadow = keyof typeof shadows;
export type Glow = keyof typeof glows;
