import path from "node:path";

function resolveIfRelative(target: Record<string, unknown>, key: string, rootDir: string) {
    const value = target[key];
    if (typeof value === "string" && value.trim()) {
        if (!path.isAbsolute(value)) {
            target[key] = path.resolve(rootDir, value);
        }
    }
}

export function resolveApprovedToolArgs(
    toolName: string,
    args: Record<string, unknown>,
    rootDir: string,
): Record<string, unknown> {
    const resolved = { ...(args ?? {}) };
    const workspaceRoot = path.resolve(rootDir);

    if (toolName === "write_file") {
        if (typeof resolved.filePath !== "string" && typeof resolved.path === "string") {
            resolved.filePath = resolved.path;
        }
        resolveIfRelative(resolved, "filePath", workspaceRoot);
        if (!resolved.repoPath) {
            resolved.repoPath = workspaceRoot;
        }
        resolveIfRelative(resolved, "repoPath", workspaceRoot);
        return resolved;
    }

    if (toolName === "str_replace_editor") {
        if (typeof resolved.path !== "string" && typeof resolved.filePath === "string") {
            resolved.path = resolved.filePath;
        }
        if (typeof resolved.filePath !== "string" && typeof resolved.path === "string") {
            resolved.filePath = resolved.path;
        }
        resolveIfRelative(resolved, "path", workspaceRoot);
        resolveIfRelative(resolved, "filePath", workspaceRoot);
        if (!resolved.repoPath) {
            resolved.repoPath = workspaceRoot;
        }
        resolveIfRelative(resolved, "repoPath", workspaceRoot);
        return resolved;
    }

    if (toolName === "execute_bash" && !resolved.path) {
        resolved.path = workspaceRoot;
    }

    resolveIfRelative(resolved, "path", workspaceRoot);
    resolveIfRelative(resolved, "filePath", workspaceRoot);
    resolveIfRelative(resolved, "repoPath", workspaceRoot);
    return resolved;
}
