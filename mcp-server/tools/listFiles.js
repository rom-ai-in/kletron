import { glob } from "glob";
import path from "path";
import { resolveRepoPath } from "./pathUtils.js";

export const listFiles = {
    description: "List all files in a repository",
    inputSchema: {
    type: "object",
        properties: {
            path: {
                type: "string",
                description: "Path to the folder. If not provided, uses the default configured directory."
            },
            maxDepth: {
                type: "number",
                minimum: 0,
                description: "Optional maximum recursion depth (0 = root level, 1 = include first-level children, etc.)."
            }
        }
        // "path" is no longer required in 'required' array
    },
    async run({ path: providedPath, maxDepth } = {}) {
        const resolvedPath = resolveRepoPath(providedPath);
        const files = await glob("**/*", {
            cwd: resolvedPath,
            nodir: true,
            ignore: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**"]
        });

        if (typeof maxDepth === "number" && Number.isFinite(maxDepth)) {
            const limit = Math.max(0, Math.floor(maxDepth));
            return files.filter((file) => file.split("/").length - 1 <= limit);
        }

        return files;
    }
};
