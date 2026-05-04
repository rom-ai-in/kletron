// Per-workspace plugin installs (Cowork-style bundles).

import { ObjectId } from "mongodb";
import { getDatabase } from "../lib/db";
import { collectSkillSlugsFromPluginIds, getPlugin, listPlugins } from "@kletron/shared";
import { getSkillBySlug, setWorkspaceSkill } from "./skillsService";

const WORKSPACE_PLUGINS_COLLECTION = "workspace_plugins";

interface WorkspacePluginDoc {
    _id?: ObjectId;
    workspaceId: string;
    pluginId: string;
    installedAt: Date;
}

async function workspacePluginsCollection() {
    const db = await getDatabase();
    return db.collection<WorkspacePluginDoc>(WORKSPACE_PLUGINS_COLLECTION);
}

let indexesEnsured = false;
async function ensureIndexes() {
    if (indexesEnsured) return;
    indexesEnsured = true;
    try {
        const c = await workspacePluginsCollection();
        await c.createIndex({ workspaceId: 1, pluginId: 1 }, { unique: true });
    } catch (error) {
        console.warn("[pluginsService] ensureIndexes:", (error as Error).message);
    }
}

export async function listInstalledPluginIds(workspaceId: string): Promise<string[]> {
    await ensureIndexes();
    const c = await workspacePluginsCollection();
    const docs = await c.find({ workspaceId }).toArray();
    return docs.map((d) => d.pluginId);
}

export async function isPluginInstalled(workspaceId: string, pluginId: string): Promise<boolean> {
    await ensureIndexes();
    const c = await workspacePluginsCollection();
    const doc = await c.findOne({ workspaceId, pluginId });
    return !!doc;
}

/**
 * Records install and bulk-enables all plugin skill slugs that exist in the library.
 */
export async function installPlugin(workspaceId: string, pluginId: string): Promise<void> {
    const plugin = getPlugin(pluginId);
    if (!plugin) {
        throw new Error(`Unknown plugin: ${pluginId}`);
    }

    await ensureIndexes();
    const c = await workspacePluginsCollection();
    const now = new Date();
    await c.updateOne(
        { workspaceId, pluginId },
        {
            $set: { installedAt: now },
            $setOnInsert: { workspaceId, pluginId },
        },
        { upsert: true }
    );

    for (const slug of plugin.skillSlugs) {
        const skill = await getSkillBySlug(slug);
        if (!skill) {
            console.warn(`[pluginsService] Skill "${slug}" missing from library; skipping enable`);
            continue;
        }
        await setWorkspaceSkill(workspaceId, slug, true);
    }
}

/**
 * Deletes the install row and disables this plugin's skill slugs, except slugs still listed by
 * another installed plugin on the same workspace (overlap-aware).
 */
export async function removePlugin(workspaceId: string, pluginId: string): Promise<boolean> {
    await ensureIndexes();
    const installedIds = await listInstalledPluginIds(workspaceId);
    const otherInstalledIds = installedIds.filter((id) => id !== pluginId);
    const protectedSlugs = collectSkillSlugsFromPluginIds(otherInstalledIds);

    const plugin = getPlugin(pluginId);
    if (plugin) {
        for (const slug of plugin.skillSlugs) {
            if (protectedSlugs.has(slug)) continue;
            await setWorkspaceSkill(workspaceId, slug, false);
        }
    }

    const c = await workspacePluginsCollection();
    const res = await c.deleteOne({ workspaceId, pluginId });
    return (res.deletedCount ?? 0) > 0;
}

export function listPluginDefinitions() {
    return listPlugins();
}
