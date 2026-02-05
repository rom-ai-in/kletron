// Design System Component Exports - v4.0
// Central barrel file for the Numezis Design System

// =============================================================================
// DESIGN TOKENS (v4.0)
// =============================================================================

// Re-export all tokens for convenient access
export { tokens, colors, spacing, radius, typography, motion, shadows, zIndex } from '@numezis/ui/tokens';
export type { Tokens, SpacingToken, RadiusToken, FontFamily, FontSize, Shadow, ZIndex } from '@numezis/ui/tokens';

// =============================================================================
// CORE UI COMPONENTS
// =============================================================================

// Button
export { Button } from './ui/Button';
export type { ButtonProps } from './ui/Button';

// Badge
export { Badge, StatusBadge, LoadingBadge } from './ui/Badge';
export type { BadgeProps, BadgeVariant, BadgeSize, StatusBadgeProps, StatusType } from './ui/Badge';

// Input
export { Input, SearchInput, PasswordInput } from './ui/Input';
export type { InputProps, InputSize, InputVariant, SearchInputProps, PasswordInputProps } from './ui/Input';

// Textarea
export { Textarea } from './ui/Textarea';
export type { TextareaProps, TextareaSize } from './ui/Textarea';

// Toggle/Switch
export { Toggle, Switch } from './ui/Toggle';
export type { ToggleProps, ToggleSize } from './ui/Toggle';

// Checkbox
export { Checkbox, CheckboxGroup, CheckboxGroupItem } from './ui/Checkbox';
export type { CheckboxProps, CheckboxSize, CheckboxGroupProps, CheckboxGroupItemProps } from './ui/Checkbox';

// Radio
export { Radio, RadioGroup } from './ui/Radio';
export type { RadioProps, RadioGroupProps, RadioSize } from './ui/Radio';

// Tabs
export { Tabs, TabsList, TabTrigger, TabContent } from './ui/Tabs';
export type { TabsProps, TabsVariant, TabsListProps, TabTriggerProps, TabContentProps } from './ui/Tabs';

// Toast
export { ToastProvider, useToast } from './ui/Toast';
export type { Toast, ToastType, ToastPosition, ToastProviderProps } from './ui/Toast';

// Tooltip
export { Tooltip } from './ui/Tooltip';
export type { TooltipProps, TooltipPosition } from './ui/Tooltip';

// Card
export { Card, CardHeader, CardContent, CardFooter, StatCard, FeatureCard } from './ui/Card';
export type { CardProps, CardHeaderProps, CardContentProps, CardFooterProps, StatCardProps, FeatureCardProps } from './ui/Card';

// EmptyState
export { EmptyState, LoadingState, ErrorState } from './ui/EmptyState';
export type { EmptyStateProps, EmptyStateVariant, LoadingStateProps, ErrorStateProps } from './ui/EmptyState';

// Avatar
export { Avatar, AvatarGroup } from './ui/Avatar';
export type { AvatarProps, AvatarSize, AvatarGroupProps } from './ui/Avatar';

// ProgressBar
export { ProgressBar, CircularProgress } from './ui/ProgressBar';
export type { ProgressBarProps, CircularProgressProps, ProgressSize, ProgressVariant } from './ui/ProgressBar';

// Modal
export { Modal } from './ui/Modal';

// Panel
export { Panel } from './ui/Panel';

// Skeleton
export { Skeleton } from './ui/Skeleton';

// Selector
export { Selector } from './ui/Selector';
export type { SelectorOption } from './ui/Selector';

// SelectableRow
export { SelectableRow } from './ui/SelectableRow';

// ContextMenu
export { ContextMenu } from './ui/ContextMenu';
export type { ContextMenuEntry } from './ui/ContextMenu';

// =============================================================================
// WORKSPACE COMPONENTS
// =============================================================================

export { ChatInput } from './ui/ChatInput';
export type { ChatInputProps } from './ui/ChatInput';

export { ThreadFeed } from './ui/ThreadFeed';
export type { ThreadFeedProps, ThreadItem, ThreadStatus } from './ui/ThreadFeed';

export { ToolUsePanel } from './ui/ToolUsePanel';
export type { ToolUsePanelProps, ToolUseItem, ToolUseStatus } from './ui/ToolUsePanel';

export { SettingsPanel } from './ui/SettingsPanel';
export type { SettingsPanelProps, SettingsItem } from './ui/SettingsPanel';

export { WorkspaceLayout } from './ui/WorkspaceLayout';
export type { WorkspaceLayoutProps } from './ui/WorkspaceLayout';

// =============================================================================
// TOOLING COMPONENTS (Editor-style)
// =============================================================================

export { CommandPalette, CommandIcons } from './ui/CommandPalette';
export type { CommandItem, CommandPaletteProps } from './ui/CommandPalette';

export { FileTree, createFileTree } from './ui/FileTree';
export type { FileTreeNode, FileTreeProps } from './ui/FileTree';

export { EditorTabs } from './ui/EditorTabs';
export type { EditorTab, EditorTabsProps } from './ui/EditorTabs';

export { StatusBar } from './ui/StatusBar';
export type { StatusBarItem, StatusBarProps } from './ui/StatusBar';

export { ActivityBar, ActivityIcons, defaultActivityItems, defaultBottomItems } from './ui/ActivityBar';
export type { ActivityBarItem, ActivityBarProps } from './ui/ActivityBar';

// =============================================================================
// AGENT COMPONENTS (Cursor-style AI interactions)
// =============================================================================

export { ThinkingBubble, ThinkingList } from './Agent/ThinkingBubble';
export type { ThinkingBubbleProps, ThoughtItem, ThinkingListProps } from './Agent/ThinkingBubble';

export { ToolLog } from './Agent/ToolLog';
export type { ToolCall, ToolStatus, ToolLogProps } from './Agent/ToolLog';

export { DiffApproval } from './Agent/DiffApproval';
export type { DiffFile, DiffHunk, DiffLine, DiffState, DiffApprovalProps } from './Agent/DiffApproval';

export { ContextChips, createFileChip, createFolderChip, createAgentChip, createModelChip, createTagChip } from './Agent/ContextChips';
export type { ContextChip, ContextChipsProps, ChipVariant } from './Agent/ContextChips';

export { InlineCompletion, MultiLineCompletion, useInlineCompletion } from './Agent/InlineCompletion';
export type { InlineCompletionProps, MultiLineCompletionProps, UseInlineCompletionOptions, UseInlineCompletionResult } from './Agent/InlineCompletion';

// =============================================================================
// LAYOUT COMPONENTS
// =============================================================================

export { Breadcrumbs } from './ui/Breadcrumbs';
export { BreadcrumbOverridesProvider, useBreadcrumbOverrides } from './ui/BreadcrumbOverridesProvider';
