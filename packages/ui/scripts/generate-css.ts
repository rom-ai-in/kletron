/**
 * Token CSS Generation Script
 *
 * Single source of truth: TypeScript tokens -> CSS variables.
 * Run with: tsx scripts/generate-css.ts
 * Output:   dist/tokens.css
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { rawColors } from '../src/tokens/colors';
import { rawRadius } from '../src/tokens/radius';
import { rawDuration, rawEasing } from '../src/tokens/motion';

// =============================================================================
// CSS VARIABLE MAP
// =============================================================================

const cssVars: Record<string, string> = {
  // ── Surfaces ───────────────────────────────────────────────────────────────
  '--bg-app': rawColors.bgApp,
  '--bg-surface': rawColors.bgSurface,
  '--bg-elevated': rawColors.bgElevated,

  // ── Borders ────────────────────────────────────────────────────────────────
  '--border-subtle': rawColors.borderSubtle,
  '--border-strong': rawColors.borderStrong,

  // ── Text ───────────────────────────────────────────────────────────────────
  '--text-primary': rawColors.primary,
  '--text-secondary': rawColors.secondary,
  '--text-muted': rawColors.muted,

  // ── State overlays ─────────────────────────────────────────────────────────
  '--state-hover': rawColors.stateHover,
  '--state-active': rawColors.stateActive,
  '--state-selected': rawColors.stateSelected,
  '--focus-ring': rawColors.focusRing,

  // ── Radius ─────────────────────────────────────────────────────────────────
  '--radius-sm': rawRadius.sm,
  '--radius-md': rawRadius.md,
  '--radius-lg': rawRadius.lg,
  '--radius-xl': rawRadius.xl,

  // ── Chain status ───────────────────────────────────────────────────────────
  '--chain-running': rawColors.chainRunning,
  '--chain-completed': rawColors.chainCompleted,
  '--chain-failed': rawColors.chainFailed,
  '--chain-paused': rawColors.chainPaused,

  // ── Editor Core ────────────────────────────────────────────────────────────
  '--vscode-editor-background': rawColors.editorBackground,
  '--vscode-editor-foreground': rawColors.editorForeground,
  '--vscode-editorLineNumber-foreground': rawColors.editorLineNumber,
  '--vscode-editorLineNumber-activeForeground': rawColors.editorLineNumberActive,
  '--vscode-editor-selectionBackground': rawColors.editorSelection,
  '--vscode-editor-lineHighlightBackground': rawColors.editorLineHighlight,

  // ── Sidebar ────────────────────────────────────────────────────────────────
  '--vscode-sideBar-background': rawColors.sidebarBackground,
  '--vscode-sideBar-foreground': rawColors.sidebarForeground,
  '--vscode-sideBar-border': rawColors.sidebarBorder,
  '--vscode-sideBarTitle-foreground': rawColors.sidebarTitle,
  '--vscode-sideBarSectionHeader-background': rawColors.sidebarSectionHeaderBg,
  '--vscode-sideBarSectionHeader-border': rawColors.sidebarSectionHeaderBorder,

  // ── Activity Bar ───────────────────────────────────────────────────────────
  '--vscode-activityBar-background': rawColors.activityBarBackground,
  '--vscode-activityBar-foreground': rawColors.activityBarForeground,
  '--vscode-activityBar-inactiveForeground': rawColors.activityBarInactive,
  '--vscode-activityBar-border': rawColors.activityBarBorder,
  '--vscode-activityBar-activeBorder': rawColors.activityBarActiveBorder,
  '--vscode-activityBarBadge-background': rawColors.activityBarBadgeBg,
  '--vscode-activityBarBadge-foreground': rawColors.activityBarBadgeFg,

  // ── Title Bar ──────────────────────────────────────────────────────────────
  '--vscode-titleBar-activeBackground': rawColors.titleBarBackground,
  '--vscode-titleBar-activeForeground': rawColors.titleBarForeground,
  '--vscode-titleBar-inactiveBackground': rawColors.titleBarInactiveBg,
  '--vscode-titleBar-inactiveForeground': rawColors.titleBarInactiveFg,
  '--vscode-titleBar-border': rawColors.titleBarBorder,

  // ── Tab Bar ────────────────────────────────────────────────────────────────
  '--vscode-tab-activeBackground': rawColors.tabActiveBackground,
  '--vscode-tab-activeForeground': rawColors.tabActiveForeground,
  '--vscode-tab-inactiveBackground': rawColors.tabInactiveBackground,
  '--vscode-tab-inactiveForeground': rawColors.tabInactiveForeground,
  '--vscode-tab-border': rawColors.tabBorder,
  '--vscode-tab-activeBorderTop': rawColors.tabActiveBorderTop,
  '--vscode-editorGroupHeader-tabsBackground': rawColors.editorGroupHeaderTabsBg,
  '--vscode-editorGroupHeader-tabsBorder': rawColors.editorGroupHeaderTabsBorder,

  // ── Status Bar ─────────────────────────────────────────────────────────────
  '--vscode-statusBar-background': rawColors.statusBarBackground,
  '--vscode-statusBar-foreground': rawColors.statusBarForeground,
  '--vscode-statusBar-border': rawColors.statusBarBorder,
  '--vscode-statusBar-debuggingBackground': rawColors.statusBarDebuggingBg,
  '--vscode-statusBar-debuggingForeground': rawColors.statusBarDebuggingFg,
  '--vscode-statusBarItem-prominentBackground': rawColors.statusBarItemProminentBg,
  '--vscode-statusBarItem-prominentForeground': rawColors.statusBarItemProminentFg,
  '--vscode-statusBarItem-hoverBackground': rawColors.statusBarItemHoverBg,

  // ── Panel ──────────────────────────────────────────────────────────────────
  '--vscode-panel-background': rawColors.panelBackground,
  '--vscode-panel-border': rawColors.panelBorder,
  '--vscode-panelTitle-activeBorder': rawColors.panelTitleActiveBorder,
  '--vscode-panelTitle-activeForeground': rawColors.panelTitleActiveFg,
  '--vscode-panelTitle-inactiveForeground': rawColors.panelTitleInactiveFg,

  // ── Input / Quick Pick ─────────────────────────────────────────────────────
  '--vscode-input-background': rawColors.inputBackground,
  '--vscode-input-border': rawColors.inputBorder,
  '--vscode-input-foreground': rawColors.inputForeground,
  '--vscode-input-placeholderForeground': rawColors.inputPlaceholder,
  '--vscode-quickInput-background': rawColors.quickInputBackground,
  '--vscode-quickInput-foreground': rawColors.quickInputForeground,
  '--vscode-quickInputList-focusBackground': rawColors.quickInputFocus,

  // ── Buttons ────────────────────────────────────────────────────────────────
  '--vscode-button-background': rawColors.buttonBackground,
  '--vscode-button-foreground': rawColors.buttonForeground,
  '--vscode-button-hoverBackground': rawColors.buttonHover,
  '--vscode-button-border': rawColors.buttonBorder,

  // ── Badges ─────────────────────────────────────────────────────────────────
  '--vscode-badge-background': rawColors.badgeBackground,
  '--vscode-badge-foreground': rawColors.badgeForeground,

  // ── Lists ──────────────────────────────────────────────────────────────────
  '--vscode-list-activeSelectionBackground': rawColors.listActiveSelection,
  '--vscode-list-activeSelectionForeground': rawColors.listActiveSelectionFg,
  '--vscode-list-hoverBackground': rawColors.listHoverBackground,
  '--vscode-list-hoverForeground': rawColors.listHoverForeground,
  '--vscode-list-inactiveSelectionBackground': rawColors.listInactiveSelection,

  // ── Git Decorations ────────────────────────────────────────────────────────
  '--vscode-gitDecoration-addedResourceForeground': rawColors.gitAdded,
  '--vscode-gitDecoration-modifiedResourceForeground': rawColors.gitModified,
  '--vscode-gitDecoration-deletedResourceForeground': rawColors.gitDeleted,

  // ── Diff Editor ────────────────────────────────────────────────────────────
  '--vscode-diffEditor-insertedTextBackground': rawColors.diffInserted,
  '--vscode-diffEditor-removedTextBackground': rawColors.diffRemoved,
  '--vscode-editorGutter-addedBackground': rawColors.gutterAdded,
  '--vscode-editorGutter-deletedBackground': rawColors.gutterDeleted,

  // ── Notifications ──────────────────────────────────────────────────────────
  '--vscode-notifications-background': rawColors.notificationsBg,
  '--vscode-notifications-foreground': rawColors.notificationsFg,
  '--vscode-notifications-border': rawColors.notificationsBorder,

  // ── Brand ──────────────────────────────────────────────────────────────────
  '--kletron-accent': rawColors.accent,
  '--kletron-accent-hover': rawColors.accentHover,
  '--kletron-accent-muted': rawColors.accentMuted,

  // ── Agent Interaction ──────────────────────────────────────────────────────
  '--agent-thinking': rawColors.thinking,
  '--agent-thinking-bg': rawColors.thinkingBg,
  '--agent-thinking-border': rawColors.thinkingBorder,
  '--agent-thinking-text': rawColors.thinkingText,
  '--agent-tool': rawColors.tool,
  '--agent-tool-bg': rawColors.toolBg,
  '--agent-tool-border': rawColors.toolBorder,
  '--agent-tool-text': rawColors.toolText,
  '--agent-success': rawColors.success,
  '--agent-success-bg': rawColors.successBg,
  '--agent-success-border': rawColors.successBorder,
  '--agent-error': rawColors.error,
  '--agent-error-bg': rawColors.errorBg,
  '--agent-error-border': rawColors.errorBorder,
  '--agent-running': rawColors.running,
  '--agent-running-bg': rawColors.runningBg,
  '--agent-running-border': rawColors.runningBorder,
  '--agent-pending': rawColors.pending,
  '--agent-pending-bg': rawColors.pendingBg,
  '--agent-pending-border': rawColors.pendingBorder,

  // ── Semantic Status (aliases for UI patterns) ──────────────────────────────
  '--status-success': 'var(--agent-success)',
  '--status-success-bg': 'var(--agent-success-bg)',
  '--status-success-border': 'var(--agent-success-border)',
  '--status-success-text': rawColors.statusSuccessText,
  '--status-error': 'var(--agent-error)',
  '--status-error-bg': 'var(--agent-error-bg)',
  '--status-error-border': 'var(--agent-error-border)',
  '--status-error-text': rawColors.statusErrorText,
  '--status-warning': 'var(--agent-tool)',
  '--status-warning-bg': 'var(--agent-tool-bg)',
  '--status-warning-border': 'var(--agent-tool-border)',
  '--status-warning-text': rawColors.statusWarningText,
  '--status-info': 'var(--agent-running)',
  '--status-info-bg': 'var(--agent-running-bg)',
  '--status-info-border': 'var(--agent-running-border)',
  '--status-info-text': rawColors.statusInfoText,

  // ── Motion ─────────────────────────────────────────────────────────────────
  '--anim-duration-fast': rawDuration.fast,
  '--anim-duration-normal': rawDuration.normal,
  '--anim-duration-slow': rawDuration.slow,
  '--anim-ease-default': rawEasing.default,
  '--anim-ease-bounce': rawEasing.bounce,

  // ── Diff-specific colors ─────────────────────────────────────────────────
  '--diff-add': rawColors.diffAddFg,
  '--diff-add-bg': rawColors.diffAddBg,
  '--diff-add-border': rawColors.diffAddBorder,
  '--diff-add-gutter': rawColors.diffAddGutter,
  '--diff-remove': rawColors.diffRemoveFg,
  '--diff-remove-bg': rawColors.diffRemoveBg,
  '--diff-remove-border': rawColors.diffRemoveBorder,
  '--diff-remove-gutter': rawColors.diffRemoveGutter,

  // ── Sidebar density ────────────────────────────────────────────────────────
  '--sidebar-density-padding': '6px 8px',
  '--sidebar-density-gap': '4px',
  '--sidebar-density-font': '12px',
  '--sidebar-density-icon': '16px',
};

// =============================================================================
// GENERATE CSS FILE
// =============================================================================

const lines = Object.entries(cssVars).map(([prop, value]) => `  ${prop}: ${value};`);

const css = `/* ============================================================
 * Kletron Design System - Generated Token CSS
 * DO NOT EDIT MANUALLY — generated by scripts/generate-css.ts
 * Source of truth: packages/ui/src/tokens/*.ts
 * ============================================================ */

:root {
${lines.join('\n')}

  color: var(--text-primary);
  background: var(--bg-app);
}
`;

const outPath = resolve(dirname(import.meta.url.replace('file://', '')), '..', 'src', 'styles', 'tokens.css');
mkdirSync(resolve(outPath, '..'), { recursive: true });
writeFileSync(outPath, css, 'utf-8');

console.log(`✓ Generated ${Object.keys(cssVars).length} CSS variables → ${outPath}`);
