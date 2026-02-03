/**
 * Numezis Design System - Z-Index Tokens
 * 
 * Layering scale for stacking contexts.
 * Use these to maintain consistent z-index hierarchy.
 * 
 * @example
 * import { zIndex } from '@/src/tokens';
 * <div style={{ zIndex: zIndex.dropdown }} />
 */

// =============================================================================
// Z-INDEX SCALE
// =============================================================================

export const zIndex = {
    /** -1 - Below base layer */
    behind: -1,
    /** 0 - Base layer (default) */
    base: 0,
    /** 10 - Sticky elements */
    sticky: 10,
    /** 20 - Dropdowns, popovers */
    dropdown: 20,
    /** 30 - Fixed headers, sidebars */
    fixed: 30,
    /** 40 - Modal backdrops */
    modalBackdrop: 40,
    /** 50 - Modal content */
    modal: 50,
    /** 60 - Tooltips */
    tooltip: 60,
    /** 70 - Notifications/toasts */
    toast: 70,
    /** 80 - Command palette / global overlays */
    commandPalette: 80,
    /** 100 - Maximum priority (debugging) */
    max: 100,
} as const;

// =============================================================================
// SEMANTIC Z-INDEX
// =============================================================================

export const layerIndex = {
    // App Shell
    sidebar: zIndex.fixed,
    header: zIndex.fixed,
    statusBar: zIndex.sticky,
    activityBar: zIndex.fixed,

    // Content
    contentBase: zIndex.base,
    stickyHeader: zIndex.sticky,

    // Overlays
    popover: zIndex.dropdown,
    contextMenu: zIndex.dropdown,
    combobox: zIndex.dropdown,

    // Global
    modal: zIndex.modal,
    modalBackdrop: zIndex.modalBackdrop,
    notification: zIndex.toast,
    globalSearch: zIndex.commandPalette,
} as const;

// Type exports
export type ZIndex = keyof typeof zIndex;
export type LayerIndex = keyof typeof layerIndex;
