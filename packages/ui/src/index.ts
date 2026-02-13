/**
 * Numezis Design System - Main Entry Point
 *
 * Re-exports all components, tokens, and types.
 * Import from '@numezis/ui' for convenient access.
 *
 * @example
 * import { Button, Badge, tokens } from '@numezis/ui';
 */

// Design tokens
export { tokens, colors, spacing, radius, typography, motion, shadows, zIndex } from './tokens';
export type { Tokens, SpacingToken, RadiusToken, FontFamily, FontSize, Shadow, ZIndex } from './tokens';

// Shared component types and constants
export type { Size, CompactSize, ButtonSize, Variant, StatusVariant, Emphasis, ComponentBaseProps, InteractiveComponentProps } from './types';
export { LAYOUT, FONT_SIZES } from './types';

// CVA variant definitions (for composition/extension)
export { buttonVariants } from './components/ui/Button';
export { badgeVariants } from './components/ui/Badge';

// All UI components (re-export from design-system barrel)
export {
    // Core UI
    Button,
    Badge, StatusBadge, LoadingBadge,
    Input, SearchInput, PasswordInput,
    Textarea,
    Toggle, Switch,
    Checkbox, CheckboxGroup, CheckboxGroupItem,
    Radio, RadioGroup,
    Tabs, TabsList, TabTrigger, TabContent,
    ToastProvider, useToast,
    Tooltip,
    Card, CardHeader, CardContent, CardFooter, StatCard, FeatureCard,
    EmptyState, LoadingState, ErrorState,
    Avatar, AvatarGroup,
    ProgressBar, CircularProgress,
    Modal,
    Panel,
    Skeleton,
    Selector,
    SelectableRow,
    ContextMenu,

    // Workspace
    ChatInput,
    ThreadFeed,
    ToolUsePanel,
    SettingsPanel,
    WorkspaceLayout,

    // Editor-style
    CommandPalette, CommandIcons,
    FileTree, createFileTree,
    EditorTabs,
    StatusBar,
    ActivityBar, ActivityIcons, defaultActivityItems, defaultBottomItems,

    // Agent
    ThinkingBubble, ThinkingList,
    ToolLog,
    DiffApproval,
    ContextChips, createFileChip, createFolderChip, createAgentChip, createModelChip, createTagChip,
    InlineCompletion, MultiLineCompletion, useInlineCompletion,
    CodeBlock,
    ToolOutput,
    ThoughtsPanel,
    TokenUsageDisplay, DurationDisplay, formatTokenCount, formatDuration,

    // Timeline (extracted from deep-agent)
    TimelinePanel, PhaseItem,
    EventCard,

    // Monaco editors
    CodeEditor, detectLanguage,
    DiffEditor,

    // File browser
    FileBrowser,

    // Git
    GitPanel, GitStatusBar, GitBranchSelector, GitChangedFiles, GitCommitForm,

    // LLM
    LLMSelector,

    // Settings
    MCPServerConfig,
    EnvironmentConfig,
    WorktreeManager,

    // Layout
    Breadcrumbs,
    BreadcrumbOverridesProvider, useBreadcrumbOverrides,
} from './components/design-system';

// Command Center components
export {
    TitleBar,
    ProjectSidebar,
    ConversationTabs,
    ConversationCenter,
    InputBar,
    ProjectUtilitySidebar,
    InlineDiffReview,
    SlashCommandMenu,
    MultimodalMenu,
    ReviewQueue,
    SkillsManager,
    AutomationsDashboard,
    AgentGraphSelector,
    ReplayConfirmDialog,
    AddWorkspaceModal,
} from './components/CommandCenter';

export type {
    TitleBarProps, GitDiffStats,
    ProjectSidebarProps, SidebarProject, SidebarThread, ThreadLiveStatus,
    ConversationTabsProps, ConversationTabItem,
    ConversationCenterProps,
    InputBarProps,
    ProjectUtilitySidebarProps, PendingDiffItem, FileLink, GitSidebarData,
    InlineDiffReviewProps, InlineDiff,
    SlashCommandMenuProps, SlashCommandItem,
    MultimodalMenuProps,
    ReviewQueueProps, ReviewQueueItem,
    SkillsManagerProps, SkillItem,
    AutomationsDashboardProps, AutomationItem,
    AgentGraphSelectorProps, AgentGraph,
    ReplayConfirmDialogProps, ReplayImpact, FileChange,
    AddWorkspaceModalProps,
} from './components/CommandCenter';
