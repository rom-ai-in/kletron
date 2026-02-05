import fs from "fs/promises";
import path from "path";
import { resolveRepoPath } from "./pathUtils.js";

export const dependencyInfo = {
    description: "Summarize dependencies, devDependencies, and scripts for npm/yarn projects.",
    inputSchema: {
        type: "object",
        properties: {
            path: {
                type: "string",
                description: "Target repository root."
            }
        }
    },
    async run({ path: repoPath } = {}) {
        const root = resolveRepoPath(repoPath);
        const packagePath = path.join(root, "package.json");
        let packageJson;

        try {
            const content = await fs.readFile(packagePath, "utf-8");
            packageJson = JSON.parse(content);
        } catch (err) {
            throw new Error(`Unable to read package.json at ${packagePath}: ${err.message}`);
        }

        return {
            name: packageJson.name || null,
            version: packageJson.version || null,
            dependencies: packageJson.dependencies || {},
            devDependencies: packageJson.devDependencies || {},
            optionalDependencies: packageJson.optionalDependencies || {},
            scripts: packageJson.scripts || {},
            dependencyCount: Object.keys(packageJson.dependencies || {}).length,
            devDependencyCount: Object.keys(packageJson.devDependencies || {}).length,
            hasLockfile: await checkLockfile(root)
        };
    }
};

async function checkLockfile(root) {
    const candidates = ["package-lock.json", "yarn.lock", "pnpm-lock.yaml"];
    for (const candidate of candidates) {
        try {
            await fs.access(path.join(root, candidate));
            return candidate;
        } catch {
            continue;
        }
    }
    return null;
}
