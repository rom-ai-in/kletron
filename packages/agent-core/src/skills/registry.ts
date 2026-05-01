import type { SkillDefinition, ResolvedSkill, SkillRegistryOptions } from "./types";
import { loadSkill, loadAllSkills, resolveSkill, listSkillIds } from "./loader";

// ─────────────────────────────────────────────────────────────────────────────
// SKILL REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Provider that supplies extra skills (typically from a database).
 * The registry merges these on top of the filesystem catalog so that
 * user-authored skills become first-class without changing call sites.
 */
export type ExternalSkillProvider = () => Promise<SkillDefinition[]>;

/**
 * Singleton registry for managing skills with caching and hot-reload support.
 */
export class SkillRegistry {
    private static instance: SkillRegistry | null = null;

    private cache = new Map<string, SkillDefinition>();
    private resolvedCache = new Map<string, ResolvedSkill>();
    private lastLoadTime: Date | null = null;
    private externalProviders: ExternalSkillProvider[] = [];
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
     * Force reload all skills from disk + external providers.
     */
    async reload(): Promise<void> {
        this.cache.clear();
        this.resolvedCache.clear();
        this.lastLoadTime = null;
        await this.ensureLoaded();
        console.log(`[SkillRegistry] Reloaded ${this.cache.size} skills`);
    }

    /**
     * Register an additional skill source (e.g. Mongo-backed user skills).
     * Subsequent reloads will pick up its skills as well.
     */
    registerProvider(provider: ExternalSkillProvider): void {
        if (!this.externalProviders.includes(provider)) {
            this.externalProviders.push(provider);
            // Force a refresh so that subsequent calls see the new provider.
            this.cache.clear();
            this.resolvedCache.clear();
            this.lastLoadTime = null;
        }
    }

    unregisterProvider(provider: ExternalSkillProvider): void {
        this.externalProviders = this.externalProviders.filter((p) => p !== provider);
        this.cache.clear();
        this.resolvedCache.clear();
        this.lastLoadTime = null;
    }

    /** Manually upsert a skill (used by hot-edit flows). */
    upsertSkill(skill: SkillDefinition): void {
        this.cache.set(skill.id, skill);
        this.resolvedCache.delete(skill.id);
    }

    /** Remove a skill from the in-memory cache. */
    removeSkill(skillId: string): void {
        this.cache.delete(skillId);
        this.resolvedCache.delete(skillId);
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

        // 1. Filesystem builtins (.agent/skills/*).
        let fsSkills = new Map<string, SkillDefinition>();
        try {
            fsSkills = await loadAllSkills();
        } catch (error) {
            console.warn("[SkillRegistry] Filesystem skill load failed:", error);
        }

        this.cache.clear();
        this.resolvedCache.clear();

        fsSkills.forEach((skill, id) => {
            this.cache.set(id, skill);
        });

        // 2. External providers (Mongo, etc.). Their skills can override
        //    builtins by id, mirroring how user customizations work.
        for (const provider of this.externalProviders) {
            try {
                const extras = await provider();
                for (const skill of extras) {
                    this.cache.set(skill.id, skill);
                }
            } catch (error) {
                console.warn("[SkillRegistry] External provider failed:", error);
            }
        }

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
