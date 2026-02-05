import path from "path";

import { ensurePathInside, resolveRepoPath } from "./pathUtils.js";
import { getTypeScriptLanguageService, positionFromLineAndColumn, readScriptFileText } from "./tsService.js";

function isInsideRoot(root, targetFile) {
  const rel = path.relative(root, targetFile);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function toRelative(root, fileName) {
  const absolute = path.isAbsolute(fileName) ? fileName : path.join(root, fileName);
  return path.relative(root, absolute);
}

function lineAndColumnFromPosition({ content, position }) {
  let line = 1;
  let column = 1;
  let running = 0;
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const len = (lines[i] ?? "").length + 1;
    if (running + len > position) {
      line = i + 1;
      column = position - running + 1;
      return { line, column, lines, lineIndex: i };
    }
    running += len;
  }
  return { line, column, lines, lineIndex: Math.max(0, lines.length - 1) };
}

export const goToDefinition = {
  description: "Go to definition for a TS/JS identifier at a given (file,line,column).",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Repository root (optional if defaultDir is configured)." },
      filePath: { type: "string", description: "File path relative to repo root." },
      line: { type: "number", description: "1-based line." },
      column: { type: "number", description: "1-based column." },
      maxResults: { type: "number" },
      contextLines: { type: "number" },
      cacheTtlMs: { type: "number" },
    },
    required: ["filePath", "line", "column"],
  },
  async run({ path: repoPath, filePath, line, column, maxResults = 20, contextLines = 0, cacheTtlMs = 10_000 } = {}) {
    const root = resolveRepoPath(repoPath);
    const absolute = path.isAbsolute(filePath) ? path.resolve(filePath) : path.resolve(root, filePath);
    ensurePathInside(root, absolute);

    const { fullPath, content } = await readScriptFileText({ root, relativeFilePath: filePath });
    const position = positionFromLineAndColumn({ content, line, column });
    const service = await getTypeScriptLanguageService({ root, cacheTtlMs });
    const defs = service.getDefinitionAtPosition(fullPath, position) ?? [];

    const results = [];
    for (const d of defs.slice(0, Math.max(1, Math.trunc(maxResults)))) {
      const absDef = path.resolve(d.fileName);
      const rel = toRelative(root, absDef);
      try {
        if (!isInsideRoot(root, absDef)) {
          results.push({
            file: null,
            line: null,
            column: null,
            name: d.name ?? null,
            kind: d.kind ?? null,
            snippet: null,
          });
          continue;
        }
        const { content: targetContent } = await readScriptFileText({ root, relativeFilePath: rel });
        const pos = d.textSpan?.start ?? 0;
        const { line: defLine, column: defColumn, lines, lineIndex } = lineAndColumnFromPosition({
          content: targetContent,
          position: pos,
        });
        const start = Math.max(0, lineIndex - Math.max(0, Math.trunc(contextLines)));
        const end = Math.min(lines.length - 1, lineIndex + Math.max(0, Math.trunc(contextLines)));
        results.push({
          file: rel,
          line: defLine,
          column: defColumn,
          name: d.name ?? null,
          kind: d.kind ?? null,
          snippet: lines.slice(start, end + 1).join("\n"),
        });
      } catch {
        results.push({
          file: rel,
          line: null,
          column: null,
          name: d.name ?? null,
          kind: d.kind ?? null,
          snippet: null,
        });
      }
    }

    return { definitions: results, truncated: defs.length > results.length };
  },
};
