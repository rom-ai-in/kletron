import fs from "fs/promises";
import { glob } from "glob";
import path from "path";
import { resolveRepoPath } from "./pathUtils.js";

const DEFAULT_KEYWORDS = ["TODO", "FIXME", "BUG", "HACK", "XXX"];

export const todoSearch = {
    description: "Find TODOs/FIXMEs and other flags in repository files.",
    inputSchema: {
        type: "object",
        properties: {
            path: {
                type: "string",
                description: "Target folder to scan."
            },
            keywords: {
                type: "array",
                items: { type: "string" },
                description: "Optional keywords to search for."
            }
        },
        required: []
    },
    async run({ path: repoPath, keywords } = {}) {
        const root = resolveRepoPath(repoPath);
        const searchTerms = keywords && keywords.length ? keywords : DEFAULT_KEYWORDS;
        const regex = new RegExp(`\\b(${searchTerms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "i");

        const files = await glob("**/*.{js,ts,tsx,py,md,txt,css,scss,html,json}", {
            cwd: root,
            nodir: true,
            ignore: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**"]
        });

        const results = [];

        for (const relativeFile of files) {
            const fullPath = path.join(root, relativeFile);
            let content;

            try {
                content = await fs.readFile(fullPath, "utf-8");
            } catch {
                continue;
            }

            const lines = content.split(/\r?\n/);
            lines.forEach((line, index) => {
                if (regex.test(line)) {
                    results.push({
                        file: relativeFile,
                        line: index + 1,
                        text: line.trim()
                    });
                }
            });
        }

        return {
            matches: results.slice(0, 100),
            totalMatches: results.length
        };
    }
};
