import fs from "fs/promises";
import path from "path";
import ts from "typescript";

import { resolveRepoPath } from "./pathUtils.js";
import { globCached } from "./globCache.js";
import { scriptKindFromFileName } from "./tsService.js";

function getNodeName(node) {
  if (node.name && typeof node.name.text === "string") return node.name.text;
  if (ts.isVariableStatement(node)) {
    const decl = node.declarationList.declarations[0];
    if (decl && ts.isIdentifier(decl.name)) return decl.name.text;
  }
  return null;
}

function isExported(node) {
  const mods = node.modifiers;
  if (!mods) return false;
  return mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

function kindLabel(node) {
  if (ts.isFunctionDeclaration(node)) return "function";
  if (ts.isClassDeclaration(node)) return "class";
  if (ts.isInterfaceDeclaration(node)) return "interface";
  if (ts.isTypeAliasDeclaration(node)) return "type";
  if (ts.isEnumDeclaration(node)) return "enum";
  if (ts.isVariableStatement(node)) return "variable";
  if (ts.isImportDeclaration(node)) return "import";
  if (ts.isExportDeclaration(node) || ts.isExportAssignment(node)) return "export";
  return "unknown";
}

function walkTopLevelSymbols(sourceFile) {
  const out = [];
  for (const statement of sourceFile.statements) {
    const name = getNodeName(statement);
    if (!name) continue;
    out.push({
      name,
      kind: kindLabel(statement),
      exported: isExported(statement),
      line: sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile)).line + 1,
      column: sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile)).character + 1,
    });
  }
  return out;
}

export const symbolsList = {
  description:
    "List top-level symbols for TS/JS files (fast, AST-based).",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Repository root (optional if defaultDir is configured)." },
      globs: { type: "array", items: { type: "string" }, description: "Optional glob patterns for files." },
      query: { type: "string", description: "Optional substring filter for symbol name." },
      exportedOnly: { type: "boolean", description: "Return only exported symbols." },
      maxResults: { type: "number", description: "Maximum symbols to return." },
      maxFiles: { type: "number", description: "Maximum files to scan." },
      cacheTtlMs: { type: "number", description: "Cache TTL for globbing (ms)." },
    },
  },
  async run({
    path: repoPath,
    globs,
    query,
    exportedOnly = false,
    maxResults = 500,
    maxFiles = 2_000,
    cacheTtlMs = 10_000,
  } = {}) {
    const root = resolveRepoPath(repoPath);
    const patterns = globs && globs.length ? globs : ["**/*.{ts,tsx,js,jsx}"];
    const files = await globCached({
      root,
      patterns,
      ignore: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**", "**/.next/**", "**/coverage/**"],
      ttlMs: cacheTtlMs,
    });

    const results = [];
    const queryLower = query ? query.toLowerCase() : null;

    for (const relativeFile of files.slice(0, Math.max(1, Math.trunc(maxFiles)))) {
      if (results.length >= maxResults) break;
      const fullPath = path.join(root, relativeFile);
      let content;
      try {
        content = await fs.readFile(fullPath, "utf-8");
      } catch {
        continue;
      }

      const sourceFile = ts.createSourceFile(
        fullPath,
        content,
        ts.ScriptTarget.Latest,
        true,
        scriptKindFromFileName(fullPath)
      );

      const symbols = walkTopLevelSymbols(sourceFile)
        .filter((s) => (exportedOnly ? s.exported : true))
        .filter((s) => (queryLower ? s.name.toLowerCase().includes(queryLower) : true))
        .map((s) => ({ ...s, file: relativeFile }));

      for (const s of symbols) {
        results.push(s);
        if (results.length >= maxResults) break;
      }
    }

    return { symbols: results, truncated: results.length >= maxResults };
  },
};

