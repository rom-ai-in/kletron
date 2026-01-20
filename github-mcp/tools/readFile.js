import fs from "fs/promises";
import path from "path";
import { resolveRepoPath, ensurePathInside } from "./pathUtils.js";

export const readFile = {
    description: "Read a file from a repository",
    inputSchema: {
        type: "object",
        properties: {
            repoPath: {
                type: "string",
                description: "Root path of the repository. Optional if defaultDir is configured."
            },
            filePath: { type: "string" }
        },
        required: ["filePath"]
    },
    async run({ repoPath, filePath }) {
        const resolvedRoot = resolveRepoPath(repoPath);
        const resolvedFilePath = path.isAbsolute(filePath)
            ? path.resolve(filePath)
            : path.resolve(resolvedRoot, filePath);

        ensurePathInside(resolvedRoot, resolvedFilePath);
        return await fs.readFile(resolvedFilePath, "utf-8");
    }
};
