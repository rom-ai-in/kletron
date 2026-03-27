/**
 * Kletron Design System - Shared Component Types
 *
 * Common type definitions for size, variant, and base props
 * used across all design system components.
 *
 * @example
 * import type { Size, Variant, ComponentBaseProps } from '@kletron/ui/types';
 */

// =============================================================================
// SIZE TOKENS
// =============================================================================

/** Standard size scale used across components */
export type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/** Compact size scale for space-constrained components */
export type CompactSize = 'xs' | 'sm' | 'md';

/** Extended size scale including icon-only */
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon';

// =============================================================================
// VARIANT TOKENS
// =============================================================================

/** Standard visual variants */
export type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

/** Status-oriented variants for badges and indicators */
export type StatusVariant = 'success' | 'error' | 'warning' | 'info' | 'pending' | 'running';

/** Visual emphasis levels */
export type Emphasis = 'high' | 'medium' | 'low' | 'none';

// =============================================================================
// BASE COMPONENT PROPS
// =============================================================================

/** Base props shared by all interactive components */
export interface ComponentBaseProps {
    /** Additional CSS class names */
    className?: string;
    /** Whether the component is disabled */
    disabled?: boolean;
    /** Size of the component */
    size?: Size;
}

/** Base props for interactive components that need ARIA support */
export interface InteractiveComponentProps extends ComponentBaseProps {
    /** Accessible label for screen readers */
    'aria-label'?: string;
    /** ID of element that labels this component */
    'aria-labelledby'?: string;
    /** ID of element that describes this component */
    'aria-describedby'?: string;
}

// =============================================================================
// NAMED LAYOUT CONSTANTS
// =============================================================================

/** Named width constants to replace magic pixel values */
export const LAYOUT = {
    /** Sidebar widths */
    sidebar: {
        collapsed: 'w-10',        // 40px
        compact: 'w-[200px]',
        default: 'w-[260px]',
        wide: 'w-[300px]',
        extraWide: 'w-[320px]',
    },
    /** Tab widths */
    tab: {
        min: 'min-w-[120px]',
        max: 'max-w-[200px]',
    },
    /** Context menu */
    contextMenu: {
        minWidth: 'min-w-[160px]',
    },
    /** Dropdown */
    dropdown: {
        minWidth: 'min-w-[180px]',
    },
    /** Modal */
    modal: {
        maxHeight: 'max-h-[calc(100vh-3rem)]',
    },
    /** Status bar */
    statusBar: {
        height: 'h-[22px]',
    },
    /** Selector */
    selector: {
        maxLabelWidth: 'max-w-[120px]',
    },
} as const;

/** Named font size constants (pixel values used in design system) */
export const FONT_SIZES = {
    /** 9px - Micro labels */
    micro: 'text-[9px]',
    /** 10px - Badge text, small labels */
    badge: 'text-[10px]',
    /** 11px - Compact UI text, selectors */
    compact: 'text-[11px]',
    /** 13px - Standard selector text */
    selector: 'text-[13px]',
} as const;
