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
            }
        }
        // "path" is no longer required in 'required' array
    },
    async run({ path: providedPath } = {}) {
        const resolvedPath = resolveRepoPath(providedPath);
        const files = await glob("**/*", {
            cwd: resolvedPath,
            nodir: true,
            ignore: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**"]
        });
        return files;
    }
};
