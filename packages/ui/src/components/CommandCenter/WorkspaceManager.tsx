'use client';

import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Power,
  ExternalLink,
  Wrench,
  Palette,
  Layers,
  Cloud,
  Settings2,
  Database,
  Link as LinkIcon,
  Zap,
  FileText,
  Code2,
  Search,
  Monitor,
} from 'lucide-react';

// ============================================================================
// SKILLS
// ============================================================================

export type SkillCategory = 'design' | 'project-management' | 'deployment' | 'integration' | 'custom';

export interface WorkspaceSkill {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: SkillCategory;
  requiredTools?: string[];
  suggestedTools?: string[];
}

export interface WorkspaceSkillsManagerProps {
  skills: WorkspaceSkill[];
  onAdd?: (skill: Omit<WorkspaceSkill, 'id'>) => void;
  onRemove?: (skillId: string) => void;
  onToggle?: (skillId: string, enabled: boolean) => void;
  onEdit?: (skillId: string) => void;
  className?: string;
}

const skillCategoryIcons: Record<SkillCategory, React.ReactNode> = {
  design: <Palette className="h-3.5 w-3.5" />,
  'project-management': <Layers className="h-3.5 w-3.5" />,
  deployment: <Cloud className="h-3.5 w-3.5" />,
  integration: <LinkIcon className="h-3.5 w-3.5" />,
  custom: <Settings2 className="h-3.5 w-3.5" />,
};

const skillCategoryLabels: Record<SkillCategory, string> = {
  design: 'Design',
  'project-management': 'Project Management',
  deployment: 'Deployment',
  integration: 'Integration',
  custom: 'Custom',
};

export function WorkspaceSkillsManager({
  skills,
  onAdd,
  onRemove,
  onToggle,
  onEdit,
  className = '',
}: WorkspaceSkillsManagerProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState<SkillCategory>('custom');

  const grouped = skills.reduce<Record<string, WorkspaceSkill[]>>((acc, skill) => {
    const cat = skill.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(skill);
    return acc;
  }, {});

  return (
    <div className={`space-y-3 ${className}`}>
      {Object.entries(grouped).map(([category, categorySkills]) => (
        <div key={category}>
          <div className="flex items-center gap-1.5 px-1 mb-1.5">
            {skillCategoryIcons[category as SkillCategory] ?? <Wrench className="h-3.5 w-3.5" />}
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              {skillCategoryLabels[category as SkillCategory] ?? category}
            </span>
          </div>
          <div className="space-y-1">
            {categorySkills.map((skill) => (
              <div
                key={skill.id}
                className="flex items-center justify-between rounded-md border border-border-subtle bg-bg-surface/50 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-text-primary">{skill.name}</div>
                  <div className="text-[10px] text-text-muted truncate">{skill.description}</div>
                  {skill.requiredTools && skill.requiredTools.length > 0 && (
                    <div className="text-[9px] text-text-muted mt-0.5">
                      Requires: {skill.requiredTools.join(', ')}
                    </div>
                  )}
                  {skill.suggestedTools && skill.suggestedTools.length > 0 && (
                    <div className="text-[9px] text-text-muted">
                      Suggested: {skill.suggestedTools.join(', ')}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                  {onEdit && (
                    <button
                      type="button"
                      onClick={() => onEdit(skill.id)}
                      className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-state-hover transition-colors"
                      title="Edit skill"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {onToggle && (
                    <button
                      type="button"
                      onClick={() => onToggle(skill.id, !skill.enabled)}
                      className={`p-1 rounded transition-colors ${
                        skill.enabled
                          ? 'text-status-success-text hover:bg-state-hover'
                          : 'text-text-muted hover:bg-state-hover'
                      }`}
                      title={skill.enabled ? 'Disable' : 'Enable'}
                    >
                      <Power className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {onRemove && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Remove skill "${skill.name}"?`)) {
                          onRemove(skill.id);
                        }
                      }}
                      className="p-1 rounded text-text-muted hover:text-status-error-text hover:bg-state-hover transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {skills.length === 0 && !showAdd && (
        <div className="rounded-md border border-border-subtle px-3 py-4 text-xs text-text-muted text-center">
          No skills configured for this workspace. Add skills to extend agent capabilities.
        </div>
      )}

      {showAdd ? (
        <div className="rounded-md border border-border-strong bg-bg-surface p-3 space-y-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') setShowAdd(false);
            }}
            placeholder="Skill name (e.g. figma, linear, vercel)"
            className="w-full rounded-md bg-bg-app border border-border-subtle px-2 py-1 text-xs text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
            autoFocus
          />
          <textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Describe what this skill does..."
            rows={2}
            className="w-full rounded-md bg-bg-app border border-border-subtle px-2 py-1 text-xs text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none resize-none"
          />
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Category</label>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as SkillCategory)}
              className="rounded-md bg-bg-app border border-border-subtle px-2 py-1 text-xs text-text-primary focus:border-border-strong focus:outline-none"
            >
              {Object.entries(skillCategoryLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-3 py-1 text-xs text-text-muted hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!newName.trim()}
              className="rounded-md bg-bg-elevated border border-border-strong px-3 py-1 text-xs text-text-primary hover:bg-state-active disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Skill
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 w-full rounded-md border border-dashed border-border-strong px-3 py-2 text-xs text-text-muted hover:text-text-primary hover:border-border-strong transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Skill
        </button>
      )}
    </div>
  );

  function handleAdd() {
    if (!newName.trim() || !onAdd) return;
    onAdd({
      name: newName.trim(),
      description: newDescription.trim(),
      enabled: true,
      category: newCategory,
    });
    setNewName('');
    setNewDescription('');
    setNewCategory('custom');
    setShowAdd(false);
  }
}

// ============================================================================
// CONNECTORS
// ============================================================================

export type ConnectorCategory = 'git' | 'document' | 'calendar' | 'email' | 'task' | 'notification' | 'api' | 'custom';

export interface WorkspaceConnector {
  id: string;
  name: string;
  description: string;
  connected: boolean;
  category: ConnectorCategory;
  config?: Record<string, unknown>;
}

export interface WorkspaceConnectorsManagerProps {
  connectors: WorkspaceConnector[];
  onConnect?: (connectorId: string) => void;
  onDisconnect?: (connectorId: string) => void;
  onRemove?: (connectorId: string) => void;
  onConfigure?: (connectorId: string) => void;
  onAdd?: (connector: Omit<WorkspaceConnector, 'id'>) => void;
  className?: string;
}

const connectorCategoryIcons: Record<ConnectorCategory, React.ReactNode> = {
  git: <Code2 className="h-3.5 w-3.5" />,
  document: <FileText className="h-3.5 w-3.5" />,
  calendar: <Monitor className="h-3.5 w-3.5" />,
  email: <Database className="h-3.5 w-3.5" />,
  task: <Layers className="h-3.5 w-3.5" />,
  notification: <Zap className="h-3.5 w-3.5" />,
  api: <Search className="h-3.5 w-3.5" />,
  custom: <Settings2 className="h-3.5 w-3.5" />,
};

const connectorCategoryLabels: Record<ConnectorCategory, string> = {
  git: 'Git / SCM',
  document: 'Documents',
  calendar: 'Calendar',
  email: 'Email',
  task: 'Tasks',
  notification: 'Notifications',
  api: 'API / Data',
  custom: 'Custom',
};

export function WorkspaceConnectorsManager({
  connectors,
  onConnect,
  onDisconnect,
  onRemove,
  onConfigure,
  onAdd,
  className = '',
}: WorkspaceConnectorsManagerProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState<ConnectorCategory>('custom');

  const grouped = connectors.reduce<Record<string, WorkspaceConnector[]>>((acc, conn) => {
    const cat = conn.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(conn);
    return acc;
  }, {});

  return (
    <div className={`space-y-3 ${className}`}>
      {Object.entries(grouped).map(([category, categoryConnectors]) => (
        <div key={category}>
          <div className="flex items-center gap-1.5 px-1 mb-1.5">
            {connectorCategoryIcons[category as ConnectorCategory] ?? <LinkIcon className="h-3.5 w-3.5" />}
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              {connectorCategoryLabels[category as ConnectorCategory] ?? category}
            </span>
          </div>
          <div className="space-y-1">
            {categoryConnectors.map((conn) => (
              <div
                key={conn.id}
                className="flex items-center justify-between rounded-md border border-border-subtle bg-bg-surface/50 px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${conn.connected ? 'bg-status-success' : 'bg-text-muted'}`} />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-text-primary truncate">{conn.name}</div>
                    <div className="text-[10px] text-text-muted truncate">{conn.description}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                  {onConfigure && (
                    <button
                      type="button"
                      onClick={() => onConfigure(conn.id)}
                      className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-state-hover transition-colors"
                      title="Configure"
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {conn.connected
                    ? (onDisconnect && (
                        <button
                          type="button"
                          onClick={() => onDisconnect(conn.id)}
                          className="p-1 rounded text-status-warning-text hover:bg-state-hover transition-colors"
                          title="Disconnect"
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                      ))
                    : (onConnect && (
                        <button
                          type="button"
                          onClick={() => onConnect(conn.id)}
                          className="p-1 rounded text-status-success-text hover:bg-state-hover transition-colors"
                          title="Connect"
                        >
                          <LinkIcon className="w-3.5 h-3.5" />
                        </button>
                      ))
                  }
                  {onRemove && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Remove connector "${conn.name}"?`)) {
                          onRemove(conn.id);
                        }
                      }}
                      className="p-1 rounded text-text-muted hover:text-status-error-text hover:bg-state-hover transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {connectors.length === 0 && !showAdd && (
        <div className="rounded-md border border-border-subtle px-3 py-4 text-xs text-text-muted text-center">
          No connectors configured for this workspace. Add external service integrations.
        </div>
      )}

      {showAdd ? (
        <div className="rounded-md border border-border-strong bg-bg-surface p-3 space-y-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') setShowAdd(false);
            }}
            placeholder="Connector name (e.g. GitHub, Google Calendar)"
            className="w-full rounded-md bg-bg-app border border-border-subtle px-2 py-1 text-xs text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
            autoFocus
          />
          <textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Describe this connector..."
            rows={2}
            className="w-full rounded-md bg-bg-app border border-border-subtle px-2 py-1 text-xs text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none resize-none"
          />
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Category</label>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as ConnectorCategory)}
              className="rounded-md bg-bg-app border border-border-subtle px-2 py-1 text-xs text-text-primary focus:border-border-strong focus:outline-none"
            >
              {Object.entries(connectorCategoryLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-3 py-1 text-xs text-text-muted hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!newName.trim()}
              className="rounded-md bg-bg-elevated border border-border-strong px-3 py-1 text-xs text-text-primary hover:bg-state-active disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Connector
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 w-full rounded-md border border-dashed border-border-strong px-3 py-2 text-xs text-text-muted hover:text-text-primary hover:border-border-strong transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Connector
        </button>
      )}
    </div>
  );

  function handleAdd() {
    if (!newName.trim() || !onAdd) return;
    onAdd({
      name: newName.trim(),
      description: newDescription.trim(),
      connected: false,
      category: newCategory,
    });
    setNewName('');
    setNewDescription('');
    setNewCategory('custom');
    setShowAdd(false);
  }
}

// ============================================================================
// WORKSPACES OVERVIEW
// ============================================================================

export interface WorkspaceOverviewProps {
  /** Current workspace being edited */
  currentWorkspaceName: string;
  currentWorkspacePath: string;
  /** All workspaces for switching */
  workspaces: Array<{ id: string; name: string; path: string }>;
  onSwitchWorkspace?: (workspaceId: string) => void;
  onAddWorkspace?: () => void;
  /** Skills, connectors, automations for current workspace */
  skills: WorkspaceSkill[];
  connectors: WorkspaceConnector[];
  /** Callbacks */
  onSkillAdd?: (skill: Omit<WorkspaceSkill, 'id'>) => void;
  onSkillRemove?: (skillId: string) => void;
  onSkillToggle?: (skillId: string, enabled: boolean) => void;
  onSkillEdit?: (skillId: string) => void;
  onConnectorConnect?: (id: string) => void;
  onConnectorDisconnect?: (id: string) => void;
  onConnectorRemove?: (id: string) => void;
  onConnectorConfigure?: (id: string) => void;
  onConnectorAdd?: (connector: Omit<WorkspaceConnector, 'id'>) => void;
  className?: string;
}

export function WorkspaceOverview({
  currentWorkspaceName,
  currentWorkspacePath,
  workspaces,
  onSwitchWorkspace,
  onAddWorkspace,
  skills,
  connectors,
  onSkillAdd,
  onSkillRemove,
  onSkillToggle,
  onSkillEdit,
  onConnectorConnect,
  onConnectorDisconnect,
  onConnectorRemove,
  onConnectorConfigure,
  onConnectorAdd,
  className = '',
}: WorkspaceOverviewProps) {
  const [activeTab, setActiveTab] = useState<'skills' | 'connectors' | 'automations'>('skills');

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Workspace info */}
      <div className="rounded-md border border-border-subtle bg-bg-surface/50 px-3 py-2">
        <div className="text-xs font-medium text-text-primary">{currentWorkspaceName}</div>
        <div className="text-[10px] text-text-muted truncate">{currentWorkspacePath}</div>
      </div>

      {/* Workspace switcher */}
      {workspaces.length > 1 && onSwitchWorkspace && (
        <div className="space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted px-1">Switch Workspace</div>
          <div className="space-y-0.5">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                type="button"
                onClick={() => onSwitchWorkspace(ws.id)}
                className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                  ws.path === currentWorkspacePath
                    ? 'bg-state-selected text-text-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-state-hover'
                }`}
              >
                <Code2 className="w-3 h-3 flex-shrink-0" />
                <span className="min-w-0 truncate">{ws.name}</span>
                <span className="text-[9px] text-text-muted ml-auto flex-shrink-0">{ws.path.split('/').pop()}</span>
              </button>
            ))}
            {onAddWorkspace && (
              <button
                type="button"
                onClick={onAddWorkspace}
                className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-text-muted hover:text-text-primary hover:bg-state-hover transition-colors"
              >
                <Plus className="w-3 h-3 flex-shrink-0" />
                <span>Add workspace</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border-subtle">
        {(['skills', 'connectors', 'automations'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-[11px] font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-accent-cyan text-text-primary'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'skills' && (
        <WorkspaceSkillsManager
          skills={skills}
          onAdd={onSkillAdd}
          onRemove={onSkillRemove}
          onToggle={onSkillToggle}
          onEdit={onSkillEdit}
        />
      )}
      {activeTab === 'connectors' && (
        <WorkspaceConnectorsManager
          connectors={connectors}
          onConnect={onConnectorConnect}
          onDisconnect={onConnectorDisconnect}
          onRemove={onConnectorRemove}
          onConfigure={onConnectorConfigure}
          onAdd={onConnectorAdd}
        />
      )}
      {activeTab === 'automations' && (
        <div className="rounded-md border border-border-subtle px-3 py-6 text-xs text-text-muted text-center">
          Automations are configured per workspace. Create automations in the Settings &gt; Automations panel.
        </div>
      )}
    </div>
  );
}
