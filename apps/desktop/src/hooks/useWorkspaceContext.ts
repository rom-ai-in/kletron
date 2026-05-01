import { useState, useEffect, useCallback } from "react";

// ============================================================================
// TYPES
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

export type ConnectorCategory = 'git' | 'document' | 'calendar' | 'email' | 'task' | 'notification' | 'api' | 'custom';

export interface WorkspaceConnector {
  id: string;
  name: string;
  description: string;
  connected: boolean;
  category: ConnectorCategory;
  config?: Record<string, unknown>;
}

export interface WorkspaceAutomation {
  id: string;
  name: string;
  description?: string;
  schedule?: string;
  status: 'active' | 'paused' | 'completed' | 'failed';
  lastRunAt?: string;
  nextRunAt?: string;
  categoryId?: string;
}

export interface WorkspaceContext {
  id: string;
  name: string;
  path: string;
  /** Skills enabled for this workspace */
  skills: WorkspaceSkill[];
  /** Connectors enabled for this workspace */
  connectors: WorkspaceConnector[];
  /** Automations enabled for this workspace */
  automations: WorkspaceAutomation[];
  /** Active category for this workspace */
  activeCategory: string;
  /** Whether this workspace is read-only */
  readOnly: boolean;
  /** Health status */
  health: 'healthy' | 'missing' | 'inaccessible';
}

// ============================================================================
// DEFAULT SKILLS PER CATEGORY
// ============================================================================

const DEFAULT_SKILLS_BY_CATEGORY: Record<string, WorkspaceSkill[]> = {
  coding: [
    {
      id: 'code-review',
      name: 'Code Review',
      description: 'Review code for quality, security, and best practices',
      enabled: true,
      category: 'custom',
      requiredTools: ['read_file', 'search_code', 'git_diff'],
    },
    {
      id: 'implementation',
      name: 'Implementation',
      description: 'Write and implement code features',
      enabled: true,
      category: 'custom',
      requiredTools: ['write_file', 'read_file', 'search_code'],
    },
    {
      id: 'testing',
      name: 'Testing',
      description: 'Generate and run tests',
      enabled: true,
      category: 'custom',
      requiredTools: ['execute_bash', 'read_file'],
    },
    {
      id: 'debugging',
      name: 'Debugging',
      description: 'Help diagnose and fix bugs',
      enabled: true,
      category: 'custom',
      requiredTools: ['read_file', 'search_code', 'git_log'],
    },
  ],
  drafting: [
    {
      id: 'technical-writing',
      name: 'Technical Writing',
      description: 'Write clear technical documentation',
      enabled: true,
      category: 'custom',
    },
    {
      id: 'documentation',
      name: 'Documentation',
      description: 'Create and maintain project documentation',
      enabled: true,
      category: 'custom',
    },
    {
      id: 'summarization',
      name: 'Summarization',
      description: 'Summarize documents and content',
      enabled: true,
      category: 'custom',
    },
  ],
  automation: [
    {
      id: 'workflow-design',
      name: 'Workflow Design',
      description: 'Design automated workflows',
      enabled: true,
      category: 'custom',
    },
    {
      id: 'task-automation',
      name: 'Task Automation',
      description: 'Automate repetitive tasks',
      enabled: true,
      category: 'custom',
    },
    {
      id: 'scheduling',
      name: 'Scheduling',
      description: 'Schedule and manage recurring tasks',
      enabled: true,
      category: 'custom',
    },
  ],
  general: [
    {
      id: 'research',
      name: 'Research',
      description: 'Research topics and gather information',
      enabled: true,
      category: 'custom',
    },
    {
      id: 'explanation',
      name: 'Explanation',
      description: 'Explain concepts clearly',
      enabled: true,
      category: 'custom',
    },
    {
      id: 'brainstorming',
      name: 'Brainstorming',
      description: 'Generate ideas and solutions',
      enabled: true,
      category: 'custom',
    },
  ],
};

// ============================================================================
// DEFAULT CONNECTORS PER CATEGORY
// ============================================================================

const DEFAULT_CONNECTORS_BY_CATEGORY: Record<string, WorkspaceConnector[]> = {
  coding: [
    {
      id: 'git',
      name: 'Git',
      description: 'Version control integration',
      connected: true,
      category: 'git',
    },
    {
      id: 'github',
      name: 'GitHub',
      description: 'GitHub API integration',
      connected: false,
      category: 'git',
    },
  ],
  drafting: [
    {
      id: 'document-storage',
      name: 'Document Storage',
      description: 'Cloud document storage',
      connected: false,
      category: 'document',
    },
    {
      id: 'cloud-drive',
      name: 'Cloud Drive',
      description: 'Cloud file storage integration',
      connected: false,
      category: 'document',
    },
  ],
  automation: [
    {
      id: 'calendar',
      name: 'Calendar',
      description: 'Calendar integration',
      connected: false,
      category: 'calendar',
    },
    {
      id: 'email',
      name: 'Email',
      description: 'Email integration',
      connected: false,
      category: 'email',
    },
    {
      id: 'task-management',
      name: 'Task Management',
      description: 'Task management integration',
      connected: false,
      category: 'task',
    },
  ],
};

// ============================================================================
// HOOK
// ============================================================================

export function useWorkspaceContext(workspaceId: string | null) {
  const [workspace, setWorkspace] = useState<WorkspaceContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load workspace context when workspaceId changes
  useEffect(() => {
    if (!workspaceId) {
      setWorkspace(null);
      return;
    }

    setLoading(true);
    setError(null);

    // Load from localStorage (in production, this would be an API call)
    const loadWorkspaceContext = async () => {
      try {
        const saved = localStorage.getItem(`workspace_context_${workspaceId}`);
        if (saved) {
          setWorkspace(JSON.parse(saved));
        } else {
          // Create default workspace context based on active category
          const activeCategory = localStorage.getItem('kletron-active-category') || 'coding';
          const defaultSkills = DEFAULT_SKILLS_BY_CATEGORY[activeCategory] || DEFAULT_SKILLS_BY_CATEGORY.coding;
          const defaultConnectors = DEFAULT_CONNECTORS_BY_CATEGORY[activeCategory] || DEFAULT_CONNECTORS_BY_CATEGORY.coding;

          const defaultWorkspace: WorkspaceContext = {
            id: workspaceId,
            name: 'Unnamed Workspace',
            path: '',
            skills: defaultSkills,
            connectors: defaultConnectors,
            automations: [],
            activeCategory,
            readOnly: false,
            health: 'healthy',
          };

          setWorkspace(defaultWorkspace);
        }
      } catch (err) {
        setError('Failed to load workspace context');
      } finally {
        setLoading(false);
      }
    };

    loadWorkspaceContext();
  }, [workspaceId]);

  // Save workspace context to localStorage
  useEffect(() => {
    if (!workspaceId || !workspace) return;

    localStorage.setItem(`workspace_context_${workspaceId}`, JSON.stringify(workspace));
  }, [workspace, workspaceId]);

  // Update a skill
  const updateSkill = useCallback((skillId: string, updates: Partial<WorkspaceSkill>) => {
    if (!workspace) return;
    setWorkspace({
      ...workspace,
      skills: workspace.skills.map(s =>
        s.id === skillId ? { ...s, ...updates } : s
      ),
    });
  }, [workspace]);

  // Add a skill
  const addSkill = useCallback((skill: Omit<WorkspaceSkill, 'id'>) => {
    if (!workspace) return;
    const newSkill: WorkspaceSkill = {
      ...skill,
      id: `skill_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    };
    setWorkspace({
      ...workspace,
      skills: [...workspace.skills, newSkill],
    });
  }, [workspace]);

  // Remove a skill
  const removeSkill = useCallback((skillId: string) => {
    if (!workspace) return;
    setWorkspace({
      ...workspace,
      skills: workspace.skills.filter(s => s.id !== skillId),
    });
  }, [workspace]);

  // Toggle a skill
  const toggleSkill = useCallback((skillId: string) => {
    if (!workspace) return;
    const skill = workspace.skills.find(s => s.id === skillId);
    if (!skill) return;
    setWorkspace({
      ...workspace,
      skills: workspace.skills.map(s =>
        s.id === skillId ? { ...s, enabled: !s.enabled } : s
      ),
    });
  }, [workspace]);

  // Update a connector
  const updateConnector = useCallback((connectorId: string, updates: Partial<WorkspaceConnector>) => {
    if (!workspace) return;
    setWorkspace({
      ...workspace,
      connectors: workspace.connectors.map(c =>
        c.id === connectorId ? { ...c, ...updates } : c
      ),
    });
  }, [workspace]);

  // Add a connector
  const addConnector = useCallback((connector: Omit<WorkspaceConnector, 'id'>) => {
    if (!workspace) return;
    const newConnector: WorkspaceConnector = {
      ...connector,
      id: `connector_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    };
    setWorkspace({
      ...workspace,
      connectors: [...workspace.connectors, newConnector],
    });
  }, [workspace]);

  // Remove a connector
  const removeConnector = useCallback((connectorId: string) => {
    if (!workspace) return;
    setWorkspace({
      ...workspace,
      connectors: workspace.connectors.filter(c => c.id !== connectorId),
    });
  }, [workspace]);

  // Toggle a connector (connect/disconnect)
  const toggleConnector = useCallback((connectorId: string) => {
    if (!workspace) return;
    const connector = workspace.connectors.find(c => c.id === connectorId);
    if (!connector) return;
    setWorkspace({
      ...workspace,
      connectors: workspace.connectors.map(c =>
        c.id === connectorId ? { ...c, connected: !c.connected } : c
      ),
    });
  }, [workspace]);

  // Update active category
  const setActiveCategory = useCallback((categoryId: string) => {
    if (!workspace) return;
    setWorkspace({
      ...workspace,
      activeCategory: categoryId,
      // Update skills and connectors based on new category
      skills: DEFAULT_SKILLS_BY_CATEGORY[categoryId] || workspace.skills,
      connectors: DEFAULT_CONNECTORS_BY_CATEGORY[categoryId] || workspace.connectors,
    });
  }, [workspace]);

  // Get enabled skills
  const enabledSkills = workspace?.skills.filter(s => s.enabled) || [];

  // Get connected connectors
  const connectedConnectors = workspace?.connectors.filter(c => c.connected) || [];

  // Get active category config
  const activeCategoryConfig = BUILT_IN_CATEGORIES.find(c => c.id === workspace?.activeCategory);

  return {
    workspace,
    loading,
    error,
    enabledSkills,
    connectedConnectors,
    activeCategoryConfig,
    updateSkill,
    addSkill,
    removeSkill,
    toggleSkill,
    updateConnector,
    addConnector,
    removeConnector,
    toggleConnector,
    setActiveCategory,
  };
}

// Import BUILT_IN_CATEGORIES for the hook
import { BUILT_IN_CATEGORIES } from './useCategories';
