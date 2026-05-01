import type { WorkspaceAwareSkill, WorkCategory } from "./workspaceTypes";
import { skillRegistry } from "./registry";

/**
 * Workspace-aware skill registry extension
 */
export class WorkspaceSkillRegistry {
    private workspaceSkills = new Map<string, Map<string, Partial<WorkspaceAwareSkill>>>();
    private categorySkills = new Map<string, Set<string>>();
    
    constructor() {
        // Initialize default categories
        this.initializeDefaultCategories();
    }
    
    /**
     * Register workspace-specific skill overrides
     */
    async registerWorkspaceSkill(
        workspaceId: string,
        skillId: string,
        overrides: Partial<WorkspaceAwareSkill>
    ): Promise<void> {
        if (!this.workspaceSkills.has(workspaceId)) {
            this.workspaceSkills.set(workspaceId, new Map());
        }
        
        const workspaceMap = this.workspaceSkills.get(workspaceId)!;
        const existing = workspaceMap.get(skillId) || {};
        
        workspaceMap.set(skillId, { ...existing, ...overrides });
    }
    
    /**
     * Get skills for a specific workspace
     */
    async getWorkspaceSkills(
        workspaceId: string,
        categoryId?: string
    ): Promise<WorkspaceAwareSkill[]> {
        const baseSkills = await skillRegistry.listAll();
        const workspaceOverrides = this.workspaceSkills.get(workspaceId) || new Map();
        
        // Filter by category if specified
        let skillIds: string[] = baseSkills.map(s => s.id);
        if (categoryId) {
            const categorySkillIds = this.categorySkills.get(categoryId);
            if (categorySkillIds) {
                skillIds = Array.from(categorySkillIds);
            }
        }
        
        return skillIds.map(skillId => {
            const baseSkill = baseSkills.find(s => s.id === skillId);
            if (!baseSkill) return null;
            
            const overrides = workspaceOverrides.get(skillId);
            if (!overrides) return baseSkill;
            
            // Merge with overrides
            return {
                ...baseSkill,
                ...overrides,
                requiredTools: overrides.requiredTools || baseSkill.requiredTools,
                suggestedTools: overrides.suggestedTools || baseSkill.suggestedTools
            };
        }).filter(Boolean) as WorkspaceAwareSkill[];
    }
    
    /**
     * Get skills appropriate for a category in a workspace
     */
    async getCategorySkills(
        workspaceId: string,
        categoryId: string
    ): Promise<WorkspaceAwareSkill[]> {
        return this.getWorkspaceSkills(workspaceId, categoryId);
    }
    
    /**
     * Register a skill to one or more categories
     */
    registerSkillToCategories(
        skillId: string,
        categoryIds: string[]
    ): void {
        for (const categoryId of categoryIds) {
            if (!this.categorySkills.has(categoryId)) {
                this.categorySkills.set(categoryId, new Set());
            }
            this.categorySkills.get(categoryId)!.add(skillId);
        }
    }
    
    /**
     * Get all available categories
     */
    getCategories(): WorkCategory[] {
        // In a real implementation, this would load from config
        // For now return defaults with any dynamically registered skills
        const defaultCategories = new Map<string, WorkCategory>();
        
        DEFAULT_WORK_CATEGORIES.forEach(cat => {
            defaultCategories.set(cat.id, cat);
        });
        
        // Merge in any additional categories from registered skills
        this.categorySkills.forEach((skillIds, categoryId) => {
            if (!defaultCategories.has(categoryId)) {
                const skillExamples = Array.from(skillIds).slice(0, 3);
                defaultCategories.set(categoryId, {
                    id: categoryId,
                    name: categoryId.charAt(0).toUpperCase() + categoryId.slice(1),
                    description: `Custom category with skills: ${skillExamples.join(', ')}`,
                    icon: "📁",
                    color: "#8B5CF6"
                });
            }
        });
        
        return Array.from(defaultCategories.values());
    }
    
    private initializeDefaultCategories(): void {
        DEFAULT_WORK_CATEGORIES.forEach(cat => {
            this.categorySkills.set(cat.id, new Set(cat.defaultSkills));
        });
    }
}

// Singleton instance
const workspaceSkillRegistry = new WorkspaceSkillRegistry();

export { workspaceSkillRegistry };

// Default categories export for convenience
import { DEFAULT_WORK_CATEGORIES as defaultCategories } from "./workspaceTypes";
export const DEFAULT_WORK_CATEGORIES = defaultCategories;