/**
 * Numezis Design System - Spacing Tokens
 * 
 * 4px base scale following common UI patterns.
 * Use these for consistent spacing across the application.
 * 
 * @example
 * import { spacing } from '@numezis/ui/tokens';
 * <div style={{ padding: spacing.md, gap: spacing.sm }} />
 * 
 * // Prefer Tailwind classes
 * <div className="p-4 gap-2" />
 */

// =============================================================================
// SPACING SCALE (4px base)
// =============================================================================

export const spacing = {
    /** 0px */
    none: '0',
    /** 2px - Micro spacing (icon padding, tight inline) */
    '2xs': '0.125rem',
    /** 4px - Extra small (badge padding, tight gaps) */
    xs: '0.25rem',
    /** 8px - Small (button padding, list gaps) */
    sm: '0.5rem',
    /** 12px - Medium-small (card internal padding) */
    md: '0.75rem',
    /** 16px - Base unit (section padding, component gaps) */
    base: '1rem',
    /** 20px - Medium-large */
    lg: '1.25rem',
    /** 24px - Large (container padding) */
    xl: '1.5rem',
    /** 32px - Extra large (section gaps) */
    '2xl': '2rem',
    /** 40px - 2x large */
    '3xl': '2.5rem',
    /** 48px - 3x large (hero padding) */
    '4xl': '3rem',
    /** 64px - 4x large (page margins) */
    '5xl': '4rem',
    /** 80px */
    '6xl': '5rem',
    /** 96px */
    '7xl': '6rem',
} as const;

// =============================================================================
// SEMANTIC SPACING (Component-specific)
// =============================================================================

export const componentSpacing = {
    // Buttons
    buttonPaddingXs: `${spacing.xs} ${spacing.sm}`,      // 4px 8px
    buttonPaddingSm: `${spacing.sm} ${spacing.md}`,      // 8px 12px
    buttonPaddingMd: `${spacing.sm} ${spacing.base}`,    // 8px 16px
    buttonPaddingLg: `${spacing.md} ${spacing.xl}`,      // 12px 24px

    // Cards/Panels
    cardPadding: spacing.base,                           // 16px
    cardPaddingCompact: spacing.md,                      // 12px

    // Sidebar (high-density mode)
    sidebarItemPadding: '6px 8px',
    sidebarItemGap: spacing.xs,

    // Modal
    modalPadding: spacing.xl,                            // 24px
    modalHeaderGap: spacing.sm,                          // 8px

    // List items
    listItemPadding: `${spacing.sm} ${spacing.md}`,      // 8px 12px
    listItemGap: spacing.xs,                             // 4px

    // Form fields
    inputPadding: `${spacing.sm} ${spacing.md}`,         // 8px 12px
    labelGap: spacing.xs,                                // 4px
    fieldGap: spacing.base,                              // 16px

    // Page layout
    pageMargin: spacing['2xl'],                          // 32px
    sectionGap: spacing['3xl'],                          // 40px
    containerMaxWidth: '1280px',
} as const;

// =============================================================================
// GAP UTILITIES (for flex/grid)
// =============================================================================

export const gaps = {
    /** 2px gap */
    '2xs': spacing['2xs'],
    /** 4px gap */
    xs: spacing.xs,
    /** 8px gap */
    sm: spacing.sm,
    /** 12px gap */
    md: spacing.md,
    /** 16px gap */
    base: spacing.base,
    /** 24px gap */
    lg: spacing.xl,
    /** 32px gap */
    xl: spacing['2xl'],
} as const;

// Type exports
export type SpacingToken = keyof typeof spacing;
export type GapToken = keyof typeof gaps;
