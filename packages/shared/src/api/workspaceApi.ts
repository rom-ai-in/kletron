import { z } from "zod";

/**
 * Workspace management API schemas and types
 */

// Workspace schema
export const WorkspaceSchema = z.object({
    id: z.string(),
    name: z.string(),
    rootPath: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
    description: z.string().optional(),
    isActive: z.boolean().default(false),
});

export type Workspace = z.infer<typeof WorkspaceSchema>;

// Workspace with skills schema
export const WorkspaceWithSkillsSchema = WorkspaceSchema.extend({
    activeCategoryId: z.string().optional(),
    defaultCategoryId: z.string().optional(),
    availableCategories: z.array(
        z.object({
            id: z.string(),
            name: z.string(),
            isDefault: z.boolean()
        })
    ).optional(),
});

export type WorkspaceWithSkills = z.infer<typeof WorkspaceWithSkillsSchema>;

// Category configuration schema
export const CategoryConfigSchema = z.object({
    workspaceId: z.string(),
    categoryId: z.string(),
    isDefault: z.boolean().default(false),
    customName: z.string().optional(),
    customDescription: z.string().optional(),
    customIcon: z.string().optional(),
    customColor: z.string().optional(),
});

export type CategoryConfig = z.infer<typeof CategoryConfigSchema>;

// Skill assignment schema
export const SkillAssignmentSchema = z.object({
    workspaceId: z.string(),
    categoryId: z.string(),
    skillId: z.string(),
    isEnabled: z.boolean().default(true),
});

export type SkillAssignment = z.infer<typeof SkillAssignmentSchema>;

// Workspace API endpoints
export const WorkspaceApiSchemas = {
    // List all workspaces for a user
    listWorkspaces: {
        response: z.array(WorkspaceWithSkillsSchema),
    },
    
    // Get workspace by ID
    getWorkspace: {
        params: z.object({ workspaceId: z.string() }),
        response: WorkspaceWithSkillsSchema,
    },
    
    // Create new workspace
    createWorkspace: {
        body: z.object({
            name: z.string().min(1),
            rootPath: z.string(),
            description: z.string().optional(),
        }),
        response: WorkspaceWithSkillsSchema,
    },
    
    // Update workspace
    updateWorkspace: {
        params: z.object({ workspaceId: z.string() }),
        body: z.object({
            name: z.string().min(1).optional(),
            description: z.string().optional(),
            defaultCategoryId: z.string().optional(),
        }),
        response: WorkspaceWithSkillsSchema,
    },
    
    // Delete workspace
    deleteWorkspace: {
        params: z.object({ workspaceId: z.string() }),
        response: z.void(),
    },
    
    // Set active workspace
    setActiveWorkspace: {
        body: z.object({ workspaceId: z.string() }),
        response: WorkspaceWithSkillsSchema,
    },
    
    // Get current workspace
    getCurrentWorkspace: {
        response: WorkspaceWithSkillsSchema,
    },
    
    // Category management
    listCategories: {
        params: z.object({ workspaceId: z.string() }),
        response: z.array(
            z.object({
                id: z.string(),
                name: z.string(),
                description: z.string(),
                icon: z.string(),
                color: z.string(),
                isDefault: z.boolean(),
                skillCount: z.number(),
            })
        ),
    },
    
    // Set active category
    setActiveCategory: {
        params: z.object({ workspaceId: z.string() }),
        body: z.object({ categoryId: z.string() }),
        response: WorkspaceWithSkillsSchema,
    },
    
    // Skill management
    listWorkspaceSkills: {
        params: z.object({
            workspaceId: z.string(),
            categoryId: z.string().optional(),
        }),
        response: z.array(
            z.object({
                id: z.string(),
                name: z.string(),
                description: z.string(),
                isEnabled: z.boolean(),
                requiredTools: z.array(z.string()).optional(),
                suggestedTools: z.array(z.string()).optional(),
            })
        ),
    },
    
    // Enable/disable skill in workspace
    toggleSkill: {
        params: z.object({
            workspaceId: z.string(),
            categoryId: z.string(),
            skillId: z.string(),
        }),
        body: z.object({ isEnabled: z.boolean() }),
        response: z.void(),
    },
};

// API routes
export const WorkspaceApiRoutes = {
    WORKSPACES: "/api/workspaces",
    WORKSPACE: "/api/workspaces/:workspaceId",
    ACTIVE_WORKSPACE: "/api/workspaces/active",
    CATEGORIES: "/api/workspaces/:workspaceId/categories",
    ACTIVE_CATEGORY: "/api/workspaces/:workspaceId/category",
    SKILLS: "/api/workspaces/:workspaceId/skills",
    CATEGORY_SKILLS: "/api/workspaces/:workspaceId/categories/:categoryId/skills",
} as const;

// Helper types
export type WorkspaceApiRoute = keyof typeof WorkspaceApiRoutes;
export type WorkspaceApiSchema<T extends WorkspaceApiRoute> = 
    T extends keyof typeof WorkspaceApiSchemas ? 
        typeof WorkspaceApiSchemas[T] : 
        never;