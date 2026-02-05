/**
 * Numezis Design System - Typography Tokens
 * 
 * Font families, sizes, weights, and line heights.
 * Matches the typography defined in globals.css.
 * 
 * @example
 * import { typography as t } from '@numezis/ui/tokens';
 * <h1 style={{ fontFamily: t.fontFamily.display, fontSize: t.fontSize.xl }}>Title</h1>
 * 
 * // Prefer Tailwind classes
 * <h1 className="font-display text-xl font-semibold">Title</h1>
 */

// =============================================================================
// FONT FAMILIES
// =============================================================================

export const fontFamily = {
    /** System UI stack for headings and display text */
    display: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    /** System UI stack for body text (same as display) */
    body: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    /** Monospace stack for code, terminals, diffs */
    mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
} as const;

// =============================================================================
// FONT SIZES
// =============================================================================

export const fontSize = {
    /** 10px - Micro text (badges, labels) */
    '2xs': '0.625rem',
    /** 12px - Small text (captions, metadata) */
    xs: '0.75rem',
    /** 14px - Body text (default) */
    sm: '0.875rem',
    /** 16px - Large body text */
    base: '1rem',
    /** 18px - Heading medium */
    lg: '1.125rem',
    /** 20px - Heading large */
    xl: '1.25rem',
    /** 24px - Heading XL */
    '2xl': '1.5rem',
    /** 30px - Display small */
    '3xl': '1.875rem',
    /** 36px - Display medium */
    '4xl': '2.25rem',
    /** 48px - Display large */
    '5xl': '3rem',
    /** 60px - Hero display */
    '6xl': '3.75rem',
} as const;

// =============================================================================
// FONT WEIGHTS
// =============================================================================

export const fontWeight = {
    /** 400 - Normal body text */
    normal: '400',
    /** 500 - Medium emphasis */
    medium: '500',
    /** 600 - Semibold (buttons, headings) */
    semibold: '600',
    /** 700 - Bold emphasis */
    bold: '700',
} as const;

// =============================================================================
// LINE HEIGHTS
// =============================================================================

export const lineHeight = {
    /** 1 - Tight (display text) */
    none: '1',
    /** 1.25 - Tight headings */
    tight: '1.25',
    /** 1.375 - Slightly relaxed */
    snug: '1.375',
    /** 1.5 - Normal body text */
    normal: '1.5',
    /** 1.625 - Relaxed reading */
    relaxed: '1.625',
    /** 2 - Loose spacing */
    loose: '2',
} as const;

// =============================================================================
// LETTER SPACING
// =============================================================================

export const letterSpacing = {
    /** -0.025em - Tight (headings) */
    tighter: '-0.025em',
    /** -0.015em - Slightly tight */
    tight: '-0.015em',
    /** 0 - Normal */
    normal: '0',
    /** 0.025em - Wide */
    wide: '0.025em',
    /** 0.05em - Wider (all-caps labels) */
    wider: '0.05em',
    /** 0.1em - Widest */
    widest: '0.1em',
} as const;

// =============================================================================
// SEMANTIC TYPOGRAPHY PRESETS
// =============================================================================

export const textStyles = {
    // Headings
    h1: {
        fontSize: fontSize['2xl'],
        fontWeight: fontWeight.bold,
        lineHeight: lineHeight.tight,
        letterSpacing: letterSpacing.tight,
    },
    h2: {
        fontSize: fontSize.xl,
        fontWeight: fontWeight.semibold,
        lineHeight: lineHeight.tight,
    },
    h3: {
        fontSize: fontSize.lg,
        fontWeight: fontWeight.medium,
        lineHeight: lineHeight.snug,
    },
    h4: {
        fontSize: fontSize.base,
        fontWeight: fontWeight.medium,
        lineHeight: lineHeight.snug,
    },

    // Body
    body: {
        fontSize: fontSize.sm,
        fontWeight: fontWeight.normal,
        lineHeight: lineHeight.normal,
    },
    bodySmall: {
        fontSize: fontSize.xs,
        fontWeight: fontWeight.normal,
        lineHeight: lineHeight.normal,
    },

    // Labels
    label: {
        fontSize: fontSize.xs,
        fontWeight: fontWeight.medium,
        lineHeight: lineHeight.normal,
        letterSpacing: letterSpacing.wide,
    },
    labelUppercase: {
        fontSize: '10px',
        fontWeight: fontWeight.bold,
        lineHeight: lineHeight.normal,
        letterSpacing: letterSpacing.wider,
        textTransform: 'uppercase' as const,
    },

    // Code
    code: {
        fontFamily: fontFamily.mono,
        fontSize: fontSize.xs,
        lineHeight: lineHeight.relaxed,
    },

    // Caption
    caption: {
        fontSize: '10px',
        fontWeight: fontWeight.normal,
        lineHeight: lineHeight.normal,
        color: 'var(--text-muted)',
    },
} as const;

// =============================================================================
// UNIFIED EXPORT
// =============================================================================

export const typography = {
    fontFamily,
    fontSize,
    fontWeight,
    lineHeight,
    letterSpacing,
    styles: textStyles,
} as const;

// Type exports
export type FontFamily = keyof typeof fontFamily;
export type FontSize = keyof typeof fontSize;
export type FontWeight = keyof typeof fontWeight;
export type LineHeight = keyof typeof lineHeight;
export type TextStyle = keyof typeof textStyles;
