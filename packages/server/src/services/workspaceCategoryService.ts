// packages/server/src/services/workspaceCategoryService.ts

import type { WorkCategoryId } from '@kletron/shared';
import { DEFAULT_WORK_CATEGORIES } from '@kletron/shared';

// ============================================================================
// TYPES
// ============================================================================

export interface WorkspaceCategoryConfig {
  id: string;
  workspaceId: string;
  categoryId: WorkCategoryId;
  customName?: string;
  customTools?: string[];
  customSkills?: string[];
  customConnectors?: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceSkillConfig {
  id: string;
  workspaceId: string;
  skillId: string;
  enabled: boolean;
  category?: string;
  config?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceConnectorConfig {
  id: string;
  workspaceId: string;
  connectorId: string;
  connected: boolean;
  category?: string;
  config?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceAutomationConfig {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  schedule?: string;
  status: 'active' | 'paused' | 'completed' | 'failed';
  categoryId?: WorkCategoryId;
  config?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// WORKSPACE CATEGORY SERVICE
// ============================================================================

export class WorkspaceCategoryService {
  private static instance: WorkspaceCategoryService;

  // In-memory stores (replace with MongoDB in production)
  private categoryConfigs = new Map<string, WorkspaceCategoryConfig>();
  private skillConfigs = new Map<string, WorkspaceSkillConfig[]>();
  private connectorConfigs = new Map<string, WorkspaceConnectorConfig[]>();
  private automationConfigs = new Map<string, WorkspaceAutomationConfig[]>();

  private constructor() {}

  static getInstance(): WorkspaceCategoryService {
    if (!WorkspaceCategoryService.instance) {
      WorkspaceCategoryService.instance = new WorkspaceCategoryService();
    }
    return WorkspaceCategoryService.instance;
  }

  // ========================================================================
  // CATEGORY CONFIG
  // ========================================================================

  /**
   * Get the active category config for a workspace.
   */
  getActiveCategoryConfig(workspaceId: string): WorkspaceCategoryConfig | null {
    // Find active config
    for (const config of this.categoryConfigs.values()) {
      if (config.workspaceId === workspaceId && config.isActive) {
        return config;
      }
    }

    // Default to first built-in category
    return null;
  }

  /**
   * Get all category configs for a workspace.
   */
  getCategoryConfigs(workspaceId: string): WorkspaceCategoryConfig[] {
    return Array.from(this.categoryConfigs.values())
      .filter(c => c.workspaceId === workspaceId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  /**
   * Set the active category for a workspace.
   */
  async setActiveCategory(
    workspaceId: string,
    categoryId: WorkCategoryId,
    customName?: string,
    customTools?: string[],
    customSkills?: string[],
    customConnectors?: string[],
  ): Promise<WorkspaceCategoryConfig> {
    // Deactivate existing configs
    for (const config of this.categoryConfigs.values()) {
      if (config.workspaceId === workspaceId) {
        config.isActive = false;
      }
    }

    // Create new config
    const config: WorkspaceCategoryConfig = {
      id: `wc_${workspaceId}_${categoryId}_${Date.now()}`,
      workspaceId,
      categoryId,
      customName,
      customTools,
      customSkills,
      customConnectors,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.categoryConfigs.set(config.id, config);
    return config;
  }

  /**
   * Get the effective category config for a workspace (with fallback to defaults).
   */
  getEffectiveCategoryConfig(workspaceId: string): {
    categoryId: WorkCategoryId;
    config: WorkspaceCategoryConfig;
    defaultConfig: typeof DEFAULT_WORK_CATEGORIES[0];
  } | null {
    const activeConfig = this.getActiveCategoryConfig(workspaceId);
    if (!activeConfig) {
      return null;
    }

    const defaultConfig = DEFAULT_WORK_CATEGORIES.find(c => c.id === activeConfig.categoryId);
    if (!defaultConfig) {
      return null;
    }

    return {
      categoryId: activeConfig.categoryId,
      config: activeConfig,
      defaultConfig,
    };
  }

  // ========================================================================
  // SKILL CONFIG
  // ========================================================================

  /**
   * Get all skills for a workspace.
   */
  getSkills(workspaceId: string): WorkspaceSkillConfig[] {
    return this.skillConfigs.get(workspaceId) || [];
  }

  /**
   * Add a skill to a workspace.
   */
  async addSkill(
    workspaceId: string,
    skillId: string,
    enabled: boolean,
    category?: string,
    config?: Record<string, unknown>,
  ): Promise<WorkspaceSkillConfig> {
    const skillConfig: WorkspaceSkillConfig = {
      id: `ws_${workspaceId}_${skillId}_${Date.now()}`,
      workspaceId,
      skillId,
      enabled,
      category,
      config,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const existing = this.skillConfigs.get(workspaceId) || [];
    this.skillConfigs.set(workspaceId, [...existing, skillConfig]);
    return skillConfig;
  }

  /**
   * Update a skill configuration.
   */
  async updateSkill(
    workspaceId: string,
    skillId: string,
    updates: Partial<Pick<WorkspaceSkillConfig, 'enabled' | 'config'>>,
  ): Promise<WorkspaceSkillConfig | null> {
    const skills = this.skillConfigs.get(workspaceId) || [];
    const index = skills.findIndex(s => s.skillId === skillId);
    if (index === -1) return null;

    skills[index] = { ...skills[index], ...updates, updatedAt: new Date() };
    this.skillConfigs.set(workspaceId, skills);
    return skills[index];
  }

  /**
   * Remove a skill from a workspace.
   */
  async removeSkill(workspaceId: string, skillId: string): Promise<boolean> {
    const skills = this.skillConfigs.get(workspaceId) || [];
    const filtered = skills.filter(s => s.skillId !== skillId);
    if (filtered.length === skills.length) return false;
    this.skillConfigs.set(workspaceId, filtered);
    return true;
  }

  // ========================================================================
  // CONNECTOR CONFIG
  // ========================================================================

  /**
   * Get all connectors for a workspace.
   */
  getConnectors(workspaceId: string): WorkspaceConnectorConfig[] {
    return this.connectorConfigs.get(workspaceId) || [];
  }

  /**
   * Add a connector to a workspace.
   */
  async addConnector(
    workspaceId: string,
    connectorId: string,
    connected: boolean,
    category?: string,
    config?: Record<string, unknown>,
  ): Promise<WorkspaceConnectorConfig> {
    const connectorConfig: WorkspaceConnectorConfig = {
      id: `wc_${workspaceId}_${connectorId}_${Date.now()}`,
      workspaceId,
      connectorId,
      connected,
      category,
      config,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const existing = this.connectorConfigs.get(workspaceId) || [];
    this.connectorConfigs.set(workspaceId, [...existing, connectorConfig]);
    return connectorConfig;
  }

  /**
   * Toggle a connector's connection state.
   */
  async toggleConnector(
    workspaceId: string,
    connectorId: string,
    connected: boolean,
  ): Promise<WorkspaceConnectorConfig | null> {
    const connectors = this.connectorConfigs.get(workspaceId) || [];
    const index = connectors.findIndex(c => c.connectorId === connectorId);
    if (index === -1) return null;

    connectors[index] = { ...connectors[index], connected, updatedAt: new Date() };
    this.connectorConfigs.set(workspaceId, connectors);
    return connectors[index];
  }

  /**
   * Remove a connector from a workspace.
   */
  async removeConnector(workspaceId: string, connectorId: string): Promise<boolean> {
    const connectors = this.connectorConfigs.get(workspaceId) || [];
    const filtered = connectors.filter(c => c.connectorId !== connectorId);
    if (filtered.length === connectors.length) return false;
    this.connectorConfigs.set(workspaceId, filtered);
    return true;
  }

  // ========================================================================
  // AUTOMATION CONFIG
  // ========================================================================

  /**
   * Get all automations for a workspace.
   */
  getAutomations(workspaceId: string): WorkspaceAutomationConfig[] {
    return this.automationConfigs.get(workspaceId) || [];
  }

  /**
   * Add an automation to a workspace.
   */
  async addAutomation(
    workspaceId: string,
    name: string,
    description?: string,
    schedule?: string,
    categoryId?: WorkCategoryId,
    config?: Record<string, unknown>,
  ): Promise<WorkspaceAutomationConfig> {
    const automation: WorkspaceAutomationConfig = {
      id: `wa_${workspaceId}_${Date.now()}`,
      workspaceId,
      name,
      description,
      schedule,
      status: 'active',
      categoryId,
      config,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const existing = this.automationConfigs.get(workspaceId) || [];
    this.automationConfigs.set(workspaceId, [...existing, automation]);
    return automation;
  }

  /**
   * Update an automation's status.
   */
  async updateAutomationStatus(
    workspaceId: string,
    automationId: string,
    status: WorkspaceAutomationConfig['status'],
  ): Promise<WorkspaceAutomationConfig | null> {
    const automations = this.automationConfigs.get(workspaceId) || [];
    const index = automations.findIndex(a => a.id === automationId);
    if (index === -1) return null;

    automations[index] = { ...automations[index], status, updatedAt: new Date() };
    this.automationConfigs.set(workspaceId, automations);
    return automations[index];
  }

  /**
   * Remove an automation from a workspace.
   */
  async removeAutomation(workspaceId: string, automationId: string): Promise<boolean> {
    const automations = this.automationConfigs.get(workspaceId) || [];
    const filtered = automations.filter(a => a.id !== automationId);
    if (filtered.length === automations.length) return false;
    this.automationConfigs.set(workspaceId, filtered);
    return true;
  }

  // ========================================================================
  // WORKSPACE CONTEXT
  // ========================================================================

  /**
   * Get the full workspace context (category, skills, connectors, automations).
   */
  getWorkspaceContext(workspaceId: string): {
    category?: {
      categoryId: WorkCategoryId;
      config: WorkspaceCategoryConfig;
      defaultConfig: typeof DEFAULT_WORK_CATEGORIES[0];
    };
    skills: WorkspaceSkillConfig[];
    connectors: WorkspaceConnectorConfig[];
    automations: WorkspaceAutomationConfig[];
  } {
    const category = this.getEffectiveCategoryConfig(workspaceId);
    return {
      category: category
        ? {
            categoryId: category.categoryId,
            config: category.config,
            defaultConfig: category.defaultConfig,
          }
        : undefined,
      skills: this.getSkills(workspaceId),
      connectors: this.getConnectors(workspaceId),
      automations: this.getAutomations(workspaceId),
    };
  }

  /**
   * Clear all data for a workspace.
   */
  clearWorkspaceData(workspaceId: string): void {
    // Remove category configs
    for (const [id, config] of this.categoryConfigs.entries()) {
      if (config.workspaceId === workspaceId) {
        this.categoryConfigs.delete(id);
      }
    }

    // Remove skills
    this.skillConfigs.delete(workspaceId);

    // Remove connectors
    this.connectorConfigs.delete(workspaceId);

    // Remove automations
    this.automationConfigs.delete(workspaceId);
  }
}

// Singleton instance
export const workspaceCategoryService = WorkspaceCategoryService.getInstance();
