import path from "path";
import { config } from "../config.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "../../..");

export function ensurePathInside(root, target) {
    const allowedRoots = Array.isArray(config.workspaceRoots) && config.workspaceRoots.length > 0
        ? [...config.workspaceRoots]
        : root ? [root] : [];

    if (root && !allowedRoots.includes(root)) {
        allowedRoots.push(root);
    }

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

    const baseDir = defaultDir ? path.resolve(defaultDir) : projectRoot;
    const resolved = providedPath
        ? path.isAbsolute(providedPath)
            ? path.resolve(providedPath)
            : path.resolve(baseDir, providedPath)
        : baseDir;

    ensurePathInside(baseDir, resolved);
    return resolved;
}
