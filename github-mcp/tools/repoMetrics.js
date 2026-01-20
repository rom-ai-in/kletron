import fs from "fs/promises";
import { glob } from "glob";
import path from "path";
import { resolveRepoPath } from "./pathUtils.js";

export const repoMetrics = {
    description: "Count files/lines and report extension distribution for a repository.",
    inputSchema: {
        type: "object",
        properties: {
            path: {
                type: "string",
                description: "Target repository path (optional when defaultDir is configured)."
            }
        }
    },
    async run({ path: providedPath } = {}) {
        const root = resolveRepoPath(providedPath);
        const files = await glob("**/*", {
            cwd: root,
            nodir: true,
            ignore: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**"]
        });

        const summary = {
            totalFiles: files.length,
            totalLines: 0,
            byExtension: {},
            largestFiles: []
        };

        for (const relativeFile of files) {
            const fullPath = path.join(root, relativeFile);
            let content;

            try {
                content = await fs.readFile(fullPath, "utf-8");
            } catch {
                continue;
            }

            const lineCount = content.split(/\r?\n/).length;
            summary.totalLines += lineCount;

            const ext = path.extname(relativeFile).slice(1).toLowerCase();
            const key = ext || "no_ext";
            summary.byExtension[key] = (summary.byExtension[key] || 0) + 1;

            summary.largestFiles.push({ file: relativeFile, lines: lineCount });
        }

        summary.largestFiles.sort((a, b) => b.lines - a.lines);
        summary.largestFiles = summary.largestFiles.slice(0, 5);

        return summary;
    }
};
