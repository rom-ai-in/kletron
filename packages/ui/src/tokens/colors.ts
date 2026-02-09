/**
 * Numezis Design System - Color Tokens
 * 
 * These TypeScript constants mirror the CSS variables defined in globals.css.
 * Use these for runtime color access or when CSS vars aren't available.
 * 
 * @example
 * // For inline styles (avoid if possible)
 * import { colors } from '@numezis/ui/tokens';
 * <div style={{ background: colors.bgSurface }} />
 * 
 * // Prefer Tailwind classes
 * <div className="bg-bg-surface" />
 */

// =============================================================================
// CORE SURFACE COLORS (Zinc Scale)
// =============================================================================

export const surfaces = {
    /** Zinc 950 - Darkest app background */
    bgApp: 'var(--bg-app)',
    /** Zinc 900 - Panel/card backgrounds */
    bgSurface: 'var(--bg-surface)',
    /** Zinc 800 - Modals/popovers */
    bgElevated: 'var(--bg-elevated)',
} as const;

// =============================================================================
// BORDER COLORS
// =============================================================================

export const borders = {
    /** rgba(255, 255, 255, 0.05) - Subtle separators */
    subtle: 'var(--border-subtle)',
    /** rgba(255, 255, 255, 0.10) - Emphasized borders */
    strong: 'var(--border-strong)',
} as const;

// =============================================================================
// TEXT COLORS
// =============================================================================

export const text = {
    /** Zinc 200 - Primary readable text */
    primary: 'var(--text-primary)',
    /** Zinc 400 - Secondary/supporting text */
    secondary: 'var(--text-secondary)',
    /** Zinc 500 - Disabled/placeholder text */
    muted: 'var(--text-muted)',
} as const;

// =============================================================================
// STATE COLORS (Overlays)
// =============================================================================

export const states = {
    /** rgba(255, 255, 255, 0.04) - Hover overlay */
    hover: 'var(--state-hover)',
    /** rgba(255, 255, 255, 0.08) - Active/pressed overlay */
    active: 'var(--state-active)',
    /** Zinc 800 - Selected item background */
    selected: 'var(--state-selected)',
    /** Zinc 400 @ 40% - Focus ring color */
    focusRing: 'var(--focus-ring)',
} as const;

// =============================================================================
// CHAIN STATUS COLORS (Semantic)
// =============================================================================

export const chain = {
    /** Sky 500 - Running/in-progress */
    running: 'var(--chain-running)',
    /** Emerald 500 - Successfully completed */
    completed: 'var(--chain-completed)',
    /** Rose 500 - Failed/error */
    failed: 'var(--chain-failed)',
    /** Amber 500 - Paused/waiting */
    paused: 'var(--chain-paused)',
} as const;

// =============================================================================
// VS CODE / IDE COLORS (2026-dark.json)
// =============================================================================

export const ide = {
    // Editor
    editorBackground: 'var(--vscode-editor-background)',
    editorForeground: 'var(--vscode-editor-foreground)',
    editorLineNumber: 'var(--vscode-editorLineNumber-foreground)',
    editorLineNumberActive: 'var(--vscode-editorLineNumber-activeForeground)',
    editorSelection: 'var(--vscode-editor-selectionBackground)',
    editorLineHighlight: 'var(--vscode-editor-lineHighlightBackground)',

    // Sidebar
    sidebarBackground: 'var(--vscode-sideBar-background)',
    sidebarForeground: 'var(--vscode-sideBar-foreground)',
    sidebarBorder: 'var(--vscode-sideBar-border)',

    // Activity Bar
    activityBarBackground: 'var(--vscode-activityBar-background)',
    activityBarForeground: 'var(--vscode-activityBar-foreground)',
    activityBarInactive: 'var(--vscode-activityBar-inactiveForeground)',
    activityBarBadge: 'var(--vscode-activityBarBadge-background)',

    // Title Bar
    titleBarBackground: 'var(--vscode-titleBar-activeBackground)',
    titleBarForeground: 'var(--vscode-titleBar-activeForeground)',

    // Tabs
    tabActiveBackground: 'var(--vscode-tab-activeBackground)',
    tabActiveForeground: 'var(--vscode-tab-activeForeground)',
    tabInactiveBackground: 'var(--vscode-tab-inactiveBackground)',
    tabInactiveForeground: 'var(--vscode-tab-inactiveForeground)',
    tabBorder: 'var(--vscode-tab-border)',
    tabActiveBorderTop: 'var(--vscode-tab-activeBorderTop)',

    // Status Bar
    statusBarBackground: 'var(--vscode-statusBar-background)',
    statusBarForeground: 'var(--vscode-statusBar-foreground)',
    statusBarDebugging: 'var(--vscode-statusBar-debuggingBackground)',

    // Panel
    panelBackground: 'var(--vscode-panel-background)',
    panelBorder: 'var(--vscode-panel-border)',

    // Input
    inputBackground: 'var(--vscode-input-background)',
    inputBorder: 'var(--vscode-input-border)',
    inputForeground: 'var(--vscode-input-foreground)',
    inputPlaceholder: 'var(--vscode-input-placeholderForeground)',

    // Quick Input
    quickInputBackground: 'var(--vscode-quickInput-background)',
    quickInputForeground: 'var(--vscode-quickInput-foreground)',
    quickInputFocus: 'var(--vscode-quickInputList-focusBackground)',

    // Buttons
    buttonBackground: 'var(--vscode-button-background)',
    buttonForeground: 'var(--vscode-button-foreground)',
    buttonHover: 'var(--vscode-button-hoverBackground)',

    // Lists
    listActiveSelection: 'var(--vscode-list-activeSelectionBackground)',
    listHover: 'var(--vscode-list-hoverBackground)',

    // Git Decorations
    gitAdded: 'var(--vscode-gitDecoration-addedResourceForeground)',
    gitModified: 'var(--vscode-gitDecoration-modifiedResourceForeground)',
    gitDeleted: 'var(--vscode-gitDecoration-deletedResourceForeground)',

    // Diff
    diffInserted: 'var(--vscode-diffEditor-insertedTextBackground)',
    diffRemoved: 'var(--vscode-diffEditor-removedTextBackground)',
} as const;

// =============================================================================
// NUMEZIS BRAND COLORS
// =============================================================================

export const brand = {
    /** #3994BC - Numezis teal accent */
    accent: 'var(--numezis-accent)',
    /** #3E9BC4 - Hover state */
    accentHover: 'var(--numezis-accent-hover)',
    /** #3994BC26 - Muted/background accent */
    accentMuted: 'var(--numezis-accent-muted)',
} as const;

// =============================================================================
// AGENT / AI INTERACTION COLORS (Cursor-style)
// =============================================================================

export const agent = {
    // Thinking (Violet)
    thinking: 'var(--agent-thinking)',
    thinkingBg: 'var(--agent-thinking-bg)',
    thinkingBorder: 'var(--agent-thinking-border)',
    thinkingText: 'var(--agent-thinking-text)',

    // Tool execution (Amber)
    tool: 'var(--agent-tool)',
    toolBg: 'var(--agent-tool-bg)',
    toolBorder: 'var(--agent-tool-border)',
    toolText: 'var(--agent-tool-text)',

    // Success (Emerald)
    success: 'var(--agent-success)',
    successBg: 'var(--agent-success-bg)',
    successBorder: 'var(--agent-success-border)',

    // Error (Rose)
    error: 'var(--agent-error)',
    errorBg: 'var(--agent-error-bg)',
    errorBorder: 'var(--agent-error-border)',

    // Running (Sky)
    running: 'var(--agent-running)',
    runningBg: 'var(--agent-running-bg)',
    runningBorder: 'var(--agent-running-border)',

    // Pending (Zinc)
    pending: 'var(--agent-pending)',
    pendingBg: 'var(--agent-pending-bg)',
    pendingBorder: 'var(--agent-pending-border)',
} as const;

// =============================================================================
// RAW HEX VALUES (for contexts without CSS var support)
// =============================================================================

export const rawColors = {
    // Surfaces
    bgApp: '#09090b',
    bgSurface: '#18181b',
    bgElevated: '#27272a',

    // Borders
    borderSubtle: 'rgba(255, 255, 255, 0.05)',
    borderStrong: 'rgba(255, 255, 255, 0.10)',

    // Text
    primary: '#e4e4e7',
    secondary: '#a1a1aa',
    muted: '#71717a',

    // States
    stateHover: 'rgba(255, 255, 255, 0.03)',
    stateActive: 'rgba(255, 255, 255, 0.06)',
    stateSelected: '#1e1e21',
    focusRing: 'rgba(161, 161, 170, 0.25)',

    // Chain
    chainRunning: '#0ea5e9',
    chainCompleted: '#10b981',
    chainFailed: '#ef4444',
    chainPaused: '#f59e0b',

    // IDE (2026-dark.json canonical values)
    editorBackground: '#121314',
    editorForeground: '#BBBEBF',
    editorLineNumber: '#858889',
    editorLineNumberActive: '#BBBEBF',
    editorSelection: '#3994BC33',
    editorLineHighlight: '#242526',
    sidebarBackground: '#191A1B',
    sidebarForeground: '#bfbfbf',
    sidebarBorder: '#2A2B2CFF',
    sidebarTitle: '#bfbfbf',
    sidebarSectionHeaderBg: '#191A1B',
    sidebarSectionHeaderBorder: '#2A2B2CFF',
    activityBarBackground: '#191A1B',
    activityBarForeground: '#bfbfbf',
    activityBarInactive: '#888888',
    activityBarBorder: '#2A2B2CFF',
    activityBarActiveBorder: '#bfbfbf',
    activityBarBadgeBg: '#3994BC',
    activityBarBadgeFg: '#FFFFFF',
    titleBarBackground: '#191A1B',
    titleBarForeground: '#bfbfbf',
    titleBarInactiveBg: '#191A1B',
    titleBarInactiveFg: '#888888',
    titleBarBorder: '#2A2B2CFF',
    tabActiveBackground: '#121314',
    tabActiveForeground: '#bfbfbf',
    tabInactiveBackground: '#191A1B',
    tabInactiveForeground: '#888888',
    tabBorder: '#2A2B2CFF',
    tabActiveBorderTop: '#3994BC',
    editorGroupHeaderTabsBg: '#191A1B',
    editorGroupHeaderTabsBorder: '#2A2B2CFF',
    statusBarBackground: '#191A1B',
    statusBarForeground: '#888888',
    statusBarBorder: '#2A2B2CFF',
    statusBarDebuggingBg: '#3994BC',
    statusBarDebuggingFg: '#FFFFFF',
    statusBarItemProminentBg: '#3994BC',
    statusBarItemProminentFg: '#FFFFFF',
    statusBarItemHoverBg: '#262728',
    panelBackground: '#191A1B',
    panelBorder: '#2A2B2CFF',
    panelTitleActiveBorder: '#3994BC',
    panelTitleActiveFg: '#bfbfbf',
    panelTitleInactiveFg: '#888888',
    inputBackground: '#191A1B',
    inputBorder: '#333536FF',
    inputForeground: '#bfbfbf',
    inputPlaceholder: '#777777',
    quickInputBackground: '#202122',
    quickInputForeground: '#bfbfbf',
    quickInputFocus: '#3994BC26',
    buttonBackground: '#3994BC',
    buttonForeground: '#FFFFFF',
    buttonHover: '#3E9BC4',
    buttonBorder: '#2A2B2CFF',
    badgeBackground: '#3994BC',
    badgeForeground: '#FFFFFF',
    listActiveSelection: '#3994BC55',
    listActiveSelectionFg: '#bfbfbf',
    listHoverBackground: '#262728',
    listHoverForeground: '#bfbfbf',
    listInactiveSelection: '#2C2D2E',
    gitAdded: '#73c991',
    gitModified: '#e5ba7d',
    gitDeleted: '#f48771',
    diffInserted: '#72C89233',
    diffRemoved: '#F2877233',
    gutterAdded: '#72C892',
    gutterDeleted: '#F28772',
    notificationsBg: '#202122',
    notificationsFg: '#bfbfbf',
    notificationsBorder: '#2A2B2CFF',

    // Brand
    accent: '#3994BC',
    accentHover: '#3E9BC4',
    accentMuted: '#3994BC26',

    // Agent
    thinking: '#8b5cf6',
    thinkingBg: 'rgba(139, 92, 246, 0.1)',
    thinkingBorder: 'rgba(167, 139, 250, 0.4)',
    thinkingText: '#c4b5fd',
    tool: '#f59e0b',
    toolBg: 'rgba(245, 158, 11, 0.1)',
    toolBorder: 'rgba(251, 191, 36, 0.4)',
    toolText: '#fcd34d',
    success: '#22c55e',
    successBg: 'rgba(34, 197, 94, 0.1)',
    successBorder: 'rgba(34, 197, 94, 0.4)',
    error: '#f43f5e',
    errorBg: 'rgba(244, 63, 94, 0.1)',
    errorBorder: 'rgba(244, 63, 94, 0.4)',
    running: '#0ea5e9',
    runningBg: 'rgba(14, 165, 233, 0.1)',
    runningBorder: 'rgba(56, 189, 248, 0.4)',
    pending: '#71717a',
    pendingBg: 'rgba(113, 113, 122, 0.1)',
    pendingBorder: 'rgba(113, 113, 122, 0.4)',

    // Status (semantic aliases for UI states)
    statusSuccessText: '#6ee7b7',
    statusErrorText: '#fda4af',
    statusWarningText: '#fcd34d',
    statusInfoText: '#7dd3fc',

    // Diff-specific colors
    diffAddFg: '#73c991',
    diffAddBg: 'rgba(114, 200, 146, 0.12)',
    diffAddBorder: 'rgba(114, 200, 146, 0.3)',
    diffAddGutter: '#72C892',
    diffRemoveFg: '#f48771',
    diffRemoveBg: 'rgba(242, 135, 114, 0.12)',
    diffRemoveBorder: 'rgba(242, 135, 114, 0.3)',
    diffRemoveGutter: '#F28772',
} as const;

// =============================================================================
// UNIFIED EXPORT
// =============================================================================

export const colors = {
    ...surfaces,
    ...borders,
    text,
    states,
    chain,
    ide,
    brand,
    agent,
    raw: rawColors,
} as const;

// Type exports for consumers
export type SurfaceColor = keyof typeof surfaces;
export type BorderColor = keyof typeof borders;
export type TextColor = keyof typeof text;
export type StateColor = keyof typeof states;
export type ChainColor = keyof typeof chain;
export type IdeColor = keyof typeof ide;
export type BrandColor = keyof typeof brand;
export type AgentColor = keyof typeof agent;
