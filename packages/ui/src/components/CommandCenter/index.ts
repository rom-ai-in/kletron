// Command Center components barrel export
export { TitleBar } from './TitleBar';
export type { TitleBarProps, GitDiffStats } from './TitleBar';

export { ProjectSidebar } from './ProjectSidebar';
export type { ProjectSidebarProps, SidebarProject, SidebarThread } from './ProjectSidebar';

export { ConversationTabs } from './ConversationTabs';
export type { ConversationTabsProps, ConversationTabItem } from './ConversationTabs';

export { ConversationCenter } from './ConversationCenter';
export type { ConversationCenterProps } from './ConversationCenter';

export { InputBar } from './InputBar';
export type { InputBarProps } from './InputBar';

export { ProjectUtilitySidebar } from './ProjectUtilitySidebar';
export type { ProjectUtilitySidebarProps, PendingDiffItem, FileLink, GitSidebarData } from './ProjectUtilitySidebar';

export { AgentGraphSelector } from './AgentGraphSelector';
export type { AgentGraphSelectorProps, AgentGraph } from './AgentGraphSelector';

export { InlineDiffReview } from './InlineDiffReview';
export type { InlineDiffReviewProps, InlineDiff } from './InlineDiffReview';

export { SlashCommandMenu } from './SlashCommandMenu';
export type { SlashCommandMenuProps, SlashCommandItem } from './SlashCommandMenu';

export { MultimodalMenu } from './MultimodalMenu';
export type { MultimodalMenuProps } from './MultimodalMenu';

export { ReviewQueue } from './ReviewQueue';
export type { ReviewQueueProps, ReviewQueueItem } from './ReviewQueue';

export { SkillsManager } from './SkillsManager';
export type { SkillsManagerProps } from './SkillsManager';
export type { Skill as SkillItem } from './SkillsManager';

export { AutomationsDashboard } from './AutomationsDashboard';
export type { AutomationsDashboardProps, Automation as AutomationItem } from './AutomationsDashboard';

export { ReplayConfirmDialog } from './ReplayConfirmDialog';
export type { ReplayConfirmDialogProps, ReplayImpact, FileChange } from './ReplayConfirmDialog';
