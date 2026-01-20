import path from "path";
import { config } from "../config.js";

export function ensurePathInside(root, target) {
    const relative = path.relative(root, target);
    if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
        return;
    }
    throw new Error("Resolved path is outside of the configured repository directory.");
}

export function resolveRepoPath(providedPath) {
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
