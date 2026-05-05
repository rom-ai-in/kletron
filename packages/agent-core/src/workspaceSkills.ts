// packages/agent-core/src/workspaceSkills.ts
import type { SkillDefinition, ResolvedSkill } from "./skills/types";
import { skillRegistry } from "./skills";
import type { WorkCategoryConfig } from "@kletron/shared";

/**
 * Workspace-specific skills manager
 * Allows different sets of skills per workspace based on categories
 */
export class WorkspaceSkillsManager {
  private static instance: WorkspaceSkillsManager | null = null;

  private constructor() {}

  static getInstance(): WorkspaceSkillsManager {
    if (!WorkspaceSkillsManager.instance) {
      WorkspaceSkillsManager.instance = new WorkspaceSkillsManager();
    }
    return WorkspaceSkillsManager.instance;
  }

  /**
   * Get skills appropriate for a workspace and category
   */
  async getSkillsForCategory(
    category: WorkCategoryConfig,
    _workspaceId?: string
  ): Promise<ResolvedSkill[]> {
    // Start with required tools from category
    const requiredToolNames = category.availableTools || [];
    
    // Find skills that provide these tools
    const allSkills = await skillRegistry.listAll();
    const matchingSkills: SkillDefinition[] = [];
    
    for (const skill of allSkills) {
      if (!skill.requiredTools || skill.requiredTools.length === 0) {
        continue;
      }
      
      // Check if this skill provides any of the required tools
      const providedTools = skill.requiredTools;
      const hasMatchingTool = providedTools.some(tool => 
        requiredToolNames.includes(tool)
      );
      
      if (hasMatchingTool) {
        matchingSkills.push(skill);
      }
    }
    
    // Resolve the skills
    return skillRegistry.getSkills(matchingSkills.map(s => s.id));
  }

  /**
   * Get skills for a specific workspace context
   */
  async getWorkspaceSkills(
    workspaceId: string,
    category?: WorkCategoryConfig
  ): Promise<ResolvedSkill[]> {
    // If category is specified, use category-specific skills
    if (category) {
      return this.getSkillsForCategory(category, workspaceId);
    }
    
    // Default: get all available skills
    const skillIds = await skillRegistry.listSkillIds();
    return skillRegistry.getSkills(skillIds);
  }

  /**
   * Get skills that can be used with specific tools
   */
  async getSkillsForTools(toolNames: string[]): Promise<ResolvedSkill[]> {
    if (toolNames.length === 0) return [];
    
    const allSkills = await skillRegistry.listAll();
    const matchingSkills: SkillDefinition[] = [];
    
    for (const skill of allSkills) {
      // Check if this skill requires any of the tools
      const hasMatchingTool = toolNames.some(tool => 
        skill.requiredTools?.includes(tool) || false
      );
      
      if (hasMatchingTool) {
        matchingSkills.push(skill);
      }
    }
    
    return skillRegistry.getSkills(matchingSkills.map(s => s.id));
  }

  /**
   * Get recommended skills for a workspace based on its content
   */
  async getRecommendedSkillsForWorkspace(
    workspaceId: string,
    fileExtensions?: string[]
  ): Promise<ResolvedSkill[]> {
    // Basic recommendation logic based on file types
    const recommendations: string[] = [];
    
    if (fileExtensions) {
      const hasCodeFiles = fileExtensions.some(ext => 
        ["js", "ts", "jsx", "tsx", "py", "java", "cpp", "h", "go", "rs"].includes(ext.toLowerCase())
      );
      
      const hasConfigFiles = fileExtensions.some(ext => 
        ["json", "yaml", "yml", "toml", "env"].includes(ext.toLowerCase())
      );
      
      if (hasCodeFiles) {
        recommendations.push("code_analysis");
        recommendations.push("debugging");
      }
      
      if (hasConfigFiles) {
        recommendations.push("configuration_validation");
      }
    }
    
    // Add some default useful skills
    recommendations.push("general_assistance", "context_management");
    
    return skillRegistry.getSkills(recommendations.filter(id => 
      !recommendations.includes(id) // Remove duplicates
    ));
  }
}

export const workspaceSkillsManager = WorkspaceSkillsManager.getInstance();
