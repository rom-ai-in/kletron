import fs from "fs/promises";
import path from "path";

import { resolveRepoPath } from "./pathUtils.js";

const DEFAULT_CANDIDATES = [
  "AGENTS.md",
  "README.md",
  "package.json",
  "pnpm-workspace.yaml",
  "turbo.json",
  "lerna.json",
  "nx.json",
  "tsconfig.json",
  "apps/api/package.json",
  "apps/web/package.json",
  "apps/api/README.md",
  "apps/web/README.md",
  "docs/01-architecture/portal/portal-architecture.md",
  "docs/01-architecture/architecture.md",
  "docs/02-development/rules/backend-rules-and-checklist.md",
  "docs/02-development/rules/frontend-rules-and-checklist.md",
];

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readHead({ filePath, maxBytes }) {
  const handle = await fs.open(filePath, "r");
  try {
    const stat = await handle.stat();
    const size = Math.min(stat.size, maxBytes);
    const buffer = Buffer.alloc(size);
    await handle.read(buffer, 0, size, 0);
    return buffer.toString("utf-8");
  } finally {
    await handle.close();
  }
}

export const bootstrapContext = {
  description:
    "Load high-signal project context files (architecture/rules/config) and return small excerpts for quick grounding.",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Project root (optional if defaultDir is configured)." },
      candidates: {
        type: "array",
        items: { type: "string" },
        description: "Optional list of relative file paths to probe and read.",
      },
      maxFiles: { type: "number", description: "Maximum files to include." },
      maxBytesPerFile: { type: "number", description: "Maximum bytes read per file." },
    },
  },
  async run({ path: repoPath, candidates, maxFiles = 12, maxBytesPerFile = 18_000 } = {}) {
    const root = resolveRepoPath(repoPath);
    const list = (candidates && candidates.length ? candidates : DEFAULT_CANDIDATES).slice(
      0,
      Math.max(1, Math.trunc(maxFiles))
    );

    const found = [];
    for (const rel of list) {
      if (found.length >= maxFiles) break;
      const fullPath = path.join(root, rel);
      if (!(await fileExists(fullPath))) continue;
      try {
        const head = await readHead({ filePath: fullPath, maxBytes: Math.max(1_000, Math.trunc(maxBytesPerFile)) });
        found.push({ file: rel, head });
      } catch {
        // ignore unreadable files
      }
    }

    return {
      root,
      files: found,
      missingCandidates: list.filter((rel) => !found.some((f) => f.file === rel)),
    };
  },
};

