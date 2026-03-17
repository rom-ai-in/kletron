// Design System Component Exports - v4.0
// Central barrel file for the Kletron Design System

// =============================================================================
// DESIGN TOKENS (v4.0)
// =============================================================================

// Re-export all tokens for convenient access
export { tokens, colors, spacing, radius, typography, motion, shadows, zIndex } from '@kletron/ui/tokens';
export type { Tokens, SpacingToken, RadiusToken, FontFamily, FontSize, Shadow, ZIndex } from '@kletron/ui/tokens';

// =============================================================================
// CORE UI COMPONENTS
// =============================================================================

// Shared types
export type { Size, CompactSize, ButtonSize, Variant, StatusVariant, Emphasis, ComponentBaseProps, InteractiveComponentProps } from '../types';
export { LAYOUT, FONT_SIZES } from '../types';

// Button (with CVA variants)
export { Button, buttonVariants } from './ui/Button';
export type { ButtonProps } from './ui/Button';

// Badge (with CVA variants)
export { Badge, StatusBadge, LoadingBadge, badgeVariants } from './ui/Badge';
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

// FolderTreePicker
export { FolderTreePicker } from './ui/FolderTreePicker';
export type { FolderTreePickerProps } from './ui/FolderTreePicker';

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

export { ToolBatchAccordion } from './Agent/ToolBatchAccordion';
export type { ToolBatchAccordionProps, ToolPair } from './Agent/ToolBatchAccordion';

export { DiffApproval } from './Agent/DiffApproval';
export type { DiffFile, DiffHunk, DiffLine, DiffState, DiffApprovalProps } from './Agent/DiffApproval';

export { ContextChips, createFileChip, createFolderChip, createAgentChip, createModelChip, createTagChip } from './Agent/ContextChips';
export type { ContextChip, ContextChipsProps, ChipVariant } from './Agent/ContextChips';

export { InlineCompletion, MultiLineCompletion, useInlineCompletion } from './Agent/InlineCompletion';
export type { InlineCompletionProps, MultiLineCompletionProps, UseInlineCompletionOptions, UseInlineCompletionResult } from './Agent/InlineCompletion';

// Chat Agent Primitives (Explore + Deep Agent)
export { CodeBlock } from './Agent/CodeBlock';
export { ToolOutput } from './Agent/ToolOutput';
export { ThoughtsPanel } from './Agent/ThoughtsPanel';
export { TokenUsageDisplay, DurationDisplay, formatTokenCount, formatDuration } from './Agent/metrics';
export type { TokenUsageSummary } from './Agent/metrics';

// Timeline Panel and Event Card (extracted from deep-agent for unified Agent page)
export { TimelinePanel, PhaseItem } from './Agent/TimelinePanel';
export type { TimelinePanelProps } from './Agent/TimelinePanel';
export { EventCard } from './Agent/EventCard';
export type { EventCardProps } from './Agent/EventCard';

// Chat Message Components
export { MessageBubble, SystemMessage, CopyButton } from './Agent/ChatMessage';
export type { MessageBubbleProps, MessageRole, SystemMessageProps, CopyButtonProps } from './Agent/ChatMessage';

// Markdown Renderer
export { MarkdownRenderer } from './Agent/MarkdownRenderer';
export type { MarkdownRendererProps } from './Agent/MarkdownRenderer';

// Tool Invocation (unified tool call display)
export { ToolInvocation, ToolInvocationIcon } from './Agent/ToolInvocation';
export type { ToolInvocationProps } from './Agent/ToolInvocation';

// Message List (scrollable chat container with auto-scroll + tool pairing)
export { MessageList, groupEvents } from './Agent/MessageList';
export type { MessageListProps, ChatEvent, RenderItem } from './Agent/MessageList';

// Agent Task Queue (sidebar task list from agent graph runs)
export { AgentTaskQueue } from './Agent/AgentTaskQueue';
export type { AgentTaskQueueProps, AgentTask, AgentTaskStatus } from './Agent/AgentTaskQueue';

// Conversation List (sidebar conversation history)
export { ConversationList } from './Agent/ConversationList';
export type { ConversationListProps } from './Agent/ConversationList';

// Agent Audit Modal (audit trail viewer)
export { AgentAuditModal } from './Agent/AgentAuditModal';
export type { AgentAuditModalProps } from './Agent/AgentAuditModal';

// Agent Session Hooks (unified)
export { useAgentSession } from '../hooks/useAgentSession';
export type { UseAgentSessionReturn } from '../hooks/useAgentSession';
export { useSessionStream, normalizeMessage } from '../hooks/useSessionStream';
export type { Message, StreamStatus, TokenUsageForDisplay, UseSessionStreamOptions, UseSessionStreamReturn } from '../hooks/useSessionStream';
export { useSessionEdits } from '../hooks/useSessionEdits';
export type { SessionPendingEdit, UseSessionEditsOptions, UseSessionEditsReturn } from '../hooks/useSessionEdits';

// =============================================================================
// EDITOR COMPONENTS (Monaco-based)
// =============================================================================

export { CodeEditor, detectLanguage } from './ui/CodeEditor';
export type { CodeEditorProps, LineHighlight } from './ui/CodeEditor';

export { DiffEditor } from './ui/DiffEditor';
export type { DiffEditorProps } from './ui/DiffEditor';

// =============================================================================
// FILE BROWSER
// =============================================================================

export { FileBrowser } from './ui/FileBrowser';
export type { FileBrowserProps, FileEntry as FileBrowserEntry } from './ui/FileBrowser';

// =============================================================================
// GIT COMPONENTS
// =============================================================================

export { GitPanel, GitStatusBar, GitBranchSelector, GitChangedFiles, GitCommitForm } from './ui/GitPanel';
export type { GitPanelProps, GitStatusData } from './ui/GitPanel';

// =============================================================================
// LLM SELECTOR
// =============================================================================

export { LLMSelector } from './ui/LLMSelector';
export type { LLMSelectorProps, LLMProvider } from './ui/LLMSelector';

// =============================================================================
// SETTINGS COMPONENTS
// =============================================================================

export { MCPServerConfig } from './ui/MCPServerConfig';
export type { MCPServerConfigProps, MCPServer, MCPServerInput } from './ui/MCPServerConfig';

export { EnvironmentConfig } from './ui/EnvironmentConfig';
export type { EnvironmentConfigProps, EnvVariable } from './ui/EnvironmentConfig';

export { WorktreeManager } from './ui/WorktreeManager';
export type { WorktreeManagerProps, Worktree } from './ui/WorktreeManager';

// =============================================================================
// LAYOUT COMPONENTS
// =============================================================================

export { Breadcrumbs } from './ui/Breadcrumbs';
export { BreadcrumbOverridesProvider, useBreadcrumbOverrides } from './ui/BreadcrumbOverridesProvider';

// Marketing Layout
export { MarketingHeader, MarketingFooter } from './ui/MarketingLayout';

// Platform Components
export { TrafficLights } from './ui/TrafficLights';
export type { TrafficLightsProps } from './ui/TrafficLights';
export type { MarketingHeaderProps, MarketingFooterProps, MarketingNavLink, MarketingFooterLink } from './ui/MarketingLayout';
