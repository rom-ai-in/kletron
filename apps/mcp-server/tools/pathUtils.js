import path from "path";
import { config } from "../config.js";

export function ensurePathInside(root, target) {
    // Always reload to pick up workspace changes (e.g. after a workspace switch)
    config.reload();
    const allowedRoots = Array.isArray(config.workspaceRoots) && config.workspaceRoots.length > 0
        ? config.workspaceRoots
        : root ? [root] : [];

    for (const allowedRoot of allowedRoots) {
        const relative = path.relative(allowedRoot, target);
        if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
            return;
        }
    }
    throw new Error("Resolved path is outside of the configured repository directories.");
}

export function resolveRepoPath(providedPath) {
    // Re-read config.json on every call so new workspaces are picked up
    // without needing to restart the MCP server process.
    config.reload();

    const defaultDir = config.defaultDir;

    if (!defaultDir && !providedPath) {
        throw new Error("No default directory configured in config.js and no path provided.");
    }

    const baseDir = path.resolve(defaultDir || ".");
    const resolved = providedPath
        ? path.isAbsolute(providedPath)
            ? path.resolve(providedPath)
            : path.resolve(baseDir, providedPath)
        : baseDir;

    ensurePathInside(baseDir, resolved);
    return resolved;
}
