import fs from "fs/promises";
import path from "path";
import ts from "typescript";

import { globCached } from "./globCache.js";

const serviceCache = new Map();

function makeCacheKey(root) {
  return root;
}

function getScriptKindFromFileName(fileName) {
  if (fileName.endsWith(".ts")) return ts.ScriptKind.TS;
  if (fileName.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (fileName.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (fileName.endsWith(".js")) return ts.ScriptKind.JS;
  return ts.ScriptKind.Unknown;
}

async function listScriptFiles({ root, cacheTtlMs }) {
  const files = await globCached({
    root,
    patterns: ["**/*.{ts,tsx,js,jsx}"],
    ignore: [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**",
      "**/build/**",
      "**/.next/**",
      "**/coverage/**",
    ],
    ttlMs: cacheTtlMs,
  });
  return files.map((relative) => path.join(root, relative));
}

export async function getTypeScriptLanguageService({ root, cacheTtlMs = 10_000 }) {
  const key = makeCacheKey(root);
  const cached = serviceCache.get(key);
  const now = Date.now();
  if (cached && now - cached.createdAtMs < cacheTtlMs) {
    return cached.languageService;
  }

  const scriptFileNames = await listScriptFiles({ root, cacheTtlMs });
  const versions = new Map();
  const snapshots = new Map();

  const compilerOptions = {
    allowJs: true,
    checkJs: false,
    jsx: ts.JsxEmit.Preserve,
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
    allowNonTsExtensions: true,
    noEmit: true,
    skipLibCheck: true,
  };

  const servicesHost = {
    getScriptFileNames: () => scriptFileNames,
    getScriptVersion: (fileName) => String(versions.get(fileName) ?? "0"),
    getScriptSnapshot: (fileName) => {
      const cachedSnapshot = snapshots.get(fileName);
      if (cachedSnapshot) return cachedSnapshot;
      try {
        const text = ts.sys.readFile(fileName);
        if (text == null) return undefined;
        const snapshot = ts.ScriptSnapshot.fromString(text);
        snapshots.set(fileName, snapshot);
        return snapshot;
      } catch {
        return undefined;
      }
    },
    getCurrentDirectory: () => root,
    getCompilationSettings: () => compilerOptions,
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
    realpath: ts.sys.realpath,
    useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
    getNewLine: () => ts.sys.newLine,
    resolveModuleNames: (moduleNames, containingFile) => {
      return moduleNames.map((moduleName) => {
        const result = ts.resolveModuleName(moduleName, containingFile, compilerOptions, ts.sys);
        return result.resolvedModule;
      });
    },
  };

  // Prime versions with mtimes so the LS has stable file versions.
  await Promise.all(
    scriptFileNames.map(async (fileName) => {
      try {
        const stat = await fs.stat(fileName);
        versions.set(fileName, String(stat.mtimeMs));
      } catch {
        versions.set(fileName, "0");
      }
    })
  );

  const languageService = ts.createLanguageService(servicesHost, ts.createDocumentRegistry());
  serviceCache.set(key, { createdAtMs: now, languageService });
  return languageService;
}

export async function readScriptFileText({ root, relativeFilePath }) {
  const fullPath = path.isAbsolute(relativeFilePath) ? relativeFilePath : path.join(root, relativeFilePath);
  const content = await fs.readFile(fullPath, "utf-8");
  return { fullPath, content };
}

export function positionFromLineAndColumn({ content, line, column }) {
  const lineIndex = Math.max(0, Math.trunc(line) - 1);
  const colIndex = Math.max(0, Math.trunc(column) - 1);
  const lineStarts = ts.computeLineStarts(content);
  const start = lineStarts[Math.min(lineIndex, lineStarts.length - 1)] ?? 0;
  return Math.min(start + colIndex, content.length);
}

export function scriptKindFromFileName(fileName) {
  return getScriptKindFromFileName(fileName);
}

