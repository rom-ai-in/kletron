import fs from "fs/promises";
import path from "path";
import { resolveRepoPath } from "./pathUtils.js";

export const describeStructure = {
    description: "Describe the repository layout, key files, and obvious frameworks.",
    inputSchema: {
        type: "object",
        properties: {
            path: {
                type: "string",
                description: "Project folder to inspect."
            }
        }
    },
    async run({ path: repoPath } = {}) {
        const root = resolveRepoPath(repoPath);
        const entries = await fs.readdir(root, { withFileTypes: true });
        const directories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
        const specialFiles = ["package.json", "tsconfig.json", "webpack.config.js", "README.md", "pyproject.toml", "Cargo.toml"];

        const detectedFiles = {};
        for (const file of specialFiles) {
            try {
                await fs.access(path.join(root, file));
                detectedFiles[file] = true;
            } catch {
                detectedFiles[file] = false;
            }
        }

        const frameworks = await detectFrameworks(root);

        return {
            root,
            directories,
            detectedFiles,
            frameworks,
            topDirectories: directories.slice(0, 10)
        };
    }
};

async function detectFrameworks(root) {
    const packagePath = path.join(root, "package.json");
    try {
        const content = await fs.readFile(packagePath, "utf-8");
        const manifest = JSON.parse(content);
        const deps = { ...manifest.dependencies, ...manifest.devDependencies };
        const knownFrameworks = {
            React: ["react", "react-dom"],
            NextJS: ["next"],
            Vue: ["vue"],
            Svelte: ["svelte"],
            Express: ["express"],
            Nest: ["@nestjs/common"],
            Django: ["django"],
            Flask: ["flask"]
        };

        return Object.entries(knownFrameworks)
            .filter(([, keys]) => keys.some((key) => deps && deps[key]))
            .map(([name]) => name);
    } catch {
        return [];
    }
}
