import type { SkillDefinition, ResolvedSkill, SkillRegistryOptions } from "./types";
import { loadSkill, loadAllSkills, resolveSkill, listSkillIds } from "./loader";

// ─────────────────────────────────────────────────────────────────────────────
// SKILL REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Singleton registry for managing skills with caching and hot-reload support.
 */
export class SkillRegistry {
    private static instance: SkillRegistry | null = null;

    private cache = new Map<string, SkillDefinition>();
    private resolvedCache = new Map<string, ResolvedSkill>();
    private lastLoadTime: Date | null = null;
    private readonly options: Required<SkillRegistryOptions>;

    private constructor(options: SkillRegistryOptions = {}) {
        this.options = {
            skillsDir: options.skillsDir ?? ".agent/skills",
            watchEnabled: options.watchEnabled ?? false,
            cacheTtlMs: options.cacheTtlMs ?? 60000,
        };
    }

    /**
     * Get the singleton registry instance.
     */
    static getInstance(options?: SkillRegistryOptions): SkillRegistry {
        if (!SkillRegistry.instance) {
            SkillRegistry.instance = new SkillRegistry(options);
        }
        return SkillRegistry.instance;
    }

    /**
     * Reset the singleton (useful for testing).
     */
    static resetInstance(): void {
        SkillRegistry.instance = null;
    }

    // ─── Public API ─────────────────────────────────────────────────────────────

    /**
     * Get a single resolved skill by ID.
     */
    async getSkill(id: string): Promise<ResolvedSkill> {
        await this.ensureLoaded();

        // Check resolved cache first
        if (this.resolvedCache.has(id)) {
            return this.resolvedCache.get(id)!;
        }

        // Resolve and cache
        const resolved = await resolveSkill(id, this.cache);
        this.resolvedCache.set(id, resolved);
        return resolved;
    }

    /**
     * Get multiple resolved skills by IDs.
     */
    async getSkills(ids: string[]): Promise<ResolvedSkill[]> {
        const results: ResolvedSkill[] = [];
        for (const id of ids) {
            try {
                results.push(await this.getSkill(id));
            } catch (error) {
                console.warn(`[SkillRegistry] Failed to load skill "${id}":`, error);
            }
        }
        return results;
    }

    /**
     * Get a raw skill definition (not resolved).
     */
    async getRawSkill(id: string): Promise<SkillDefinition | undefined> {
        await this.ensureLoaded();
        return this.cache.get(id);
    }

    /**
     * List all available skill IDs.
     */
    async listSkillIds(): Promise<string[]> {
        await this.ensureLoaded();
        return Array.from(this.cache.keys()).sort();
    }

    /**
     * List all skills with their definitions.
     */
    async listAll(): Promise<SkillDefinition[]> {
        await this.ensureLoaded();
        return Array.from(this.cache.values());
    }

    /**
     * Force reload all skills from disk.
     */
    async reload(): Promise<void> {
        this.cache.clear();
        this.resolvedCache.clear();
        this.lastLoadTime = null;
        await this.ensureLoaded();
        console.log(`[SkillRegistry] Reloaded ${this.cache.size} skills`);
    }

    /**
     * Check if cache is stale and needs refresh.
     */
    isCacheStale(): boolean {
        if (!this.lastLoadTime) return true;
        const elapsed = Date.now() - this.lastLoadTime.getTime();
        return elapsed > this.options.cacheTtlMs;
    }

    // ─── Internal ───────────────────────────────────────────────────────────────

    private async ensureLoaded(): Promise<void> {
        if (this.cache.size > 0 && !this.isCacheStale()) {
            return;
        }

        const skills = await loadAllSkills();
        this.cache.clear();
        this.resolvedCache.clear();

        skills.forEach((skill, id) => {
            this.cache.set(id, skill);
        });

        this.lastLoadTime = new Date();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONVENIENCE EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the default registry instance.
 */
export const skillRegistry = SkillRegistry.getInstance();

/**
 * Convenience function to get resolved skills by IDs.
 */
export async function getSkills(ids: string[]): Promise<ResolvedSkill[]> {
    return skillRegistry.getSkills(ids);
}

/**
 * Convenience function to get a single resolved skill.
 */
export async function getSkill(id: string): Promise<ResolvedSkill> {
    return skillRegistry.getSkill(id);
}
