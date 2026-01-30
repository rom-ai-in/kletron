import path from "path";
import { minimatch } from "minimatch";
import fs from "fs/promises";

import { listFiles } from "./listFiles.js";
import { readFile } from "./readFile.js";
import { searchCode } from "./searchCode.js";
import { ensurePathInside, resolveRepoPath } from "./pathUtils.js";

const MAX_TOTAL_RESULTS = 200; // Hard cap defensive

function stripQuotes(text) {
  const t = text.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

function splitPipe(command) {
  const parts = command.split("|").map((p) => p.trim());
  return { left: parts[0] || "", right: parts[1] || "" };
}

function parseFind(command) {
  // Very small subset: find <dir> -type f -name "<pattern>"
  const tokens = command.split(/\s+/).filter(Boolean);
  const dir = tokens[1] && !tokens[1].startsWith("-") ? stripQuotes(tokens[1]) : ".";

  const nameIndex = tokens.findIndex((t) => t === "-name");
  const namePattern = nameIndex >= 0 ? stripQuotes(tokens[nameIndex + 1] || "") : null;

  const maxDepthIndex = tokens.findIndex((t) => t === "-maxdepth");
  const maxDepth = maxDepthIndex >= 0 ? Number(tokens[maxDepthIndex + 1]) : null;

  return { dir, namePattern, maxDepth };
}

function parseGrep(command) {
  // grep -r "query" <dir>
  const tokens = command.split(/\s+/).filter(Boolean);
  const queryToken = tokens.find((t) => t.startsWith('"') || t.startsWith("'")) || tokens[2];
  const query = stripQuotes(queryToken || "");
  const lastToken = tokens[tokens.length - 1];
  const dir = lastToken && !lastToken.startsWith("-") && lastToken !== queryToken ? stripQuotes(lastToken) : ".";
  return { query, dir };
}

function parseCat(command) {
  const tokens = command.split(/\s+/).filter(Boolean);
  return { filePath: tokens[1] || "" };
}

function parseHead(rightSide) {
  // head -n 10 / head -10
  if (!rightSide) return null;
  const tokens = rightSide.split(/\s+/).filter(Boolean);
  if (!tokens.length || tokens[0] !== "head") return null;
  const nIndex = tokens.findIndex((t) => t === "-n");
  if (nIndex >= 0) return Number(tokens[nIndex + 1]);
  const short = tokens.find((t) => /^-\d+$/.test(t));
  if (short) return Number(short.slice(1));
  return null;
}

function resolveEmulatedPath({ root, provided }) {
  if (!provided || provided === "." || provided === "./") return { absolute: root, relativePrefix: "" };
  const absolute = path.isAbsolute(provided) ? path.resolve(provided) : path.resolve(root, provided);
  ensurePathInside(root, absolute);
  const relativePrefix = path.relative(root, absolute).replace(/\\/g, "/");
  const prefix = relativePrefix ? `${relativePrefix.replace(/\/$/, "")}/` : "";
  return { absolute, relativePrefix: prefix };
}

export const executeBash = {
  description:
    "Compatibility shim for agents that call `execute_bash`. This MCP server does NOT execute arbitrary shell. It emulates a small safe subset (find/grep/rg/ls/cat) using existing tools. Enforces strict path safety.",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Repository root (optional if defaultDir is configured)." },
      command: { type: "string", description: "Command to emulate (limited subset only)." },
      maxResults: { type: "number" },
    },
    required: ["command"],
  },
  async run({ path: repoPath, command, maxResults = 500 } = {}) {
    const root = resolveRepoPath(repoPath);
    const raw = command.trim();
    const { left, right } = splitPipe(raw);
    const headLimit = parseHead(right);
    const effectiveMaxResults = Math.min(
      MAX_TOTAL_RESULTS,
      Number.isFinite(headLimit) ? Math.max(1, Math.trunc(headLimit)) : maxResults
    );
    const cmd = left;

    if (cmd.startsWith("find ")) {
      const { dir, namePattern, maxDepth } = parseFind(cmd);
      const files = await listFiles.run({ path: root }); // This lists ALL files recursively properly scoped
      let filtered = files;

      const { relativePrefix } = resolveEmulatedPath({ root, provided: dir });
      if (relativePrefix) {
        filtered = filtered.filter((f) => f.startsWith(relativePrefix));
      }

      if (Number.isFinite(maxDepth) && maxDepth >= 0) {
        const base = relativePrefix ? relativePrefix.replace(/\/$/, "") : "";
        filtered = filtered.filter((f) => {
          const relative = base ? f.slice(base.length + 1) : f;
          const depth = relative.split("/").length - 1;
          return depth <= maxDepth;
        });
      }

      if (namePattern) {
        filtered = filtered.filter((f) => minimatch(f.split("/").pop() || "", namePattern));
      }

      return {
        ok: true,
        emulated: "find",
        files: filtered.slice(0, Math.max(1, Math.trunc(effectiveMaxResults))),
        truncated: filtered.length > effectiveMaxResults,
      };
    }

    if (cmd.startsWith("grep ")) {
      const { query, dir } = parseGrep(cmd);
      // Ensure dir is inside root
      const { absolute } = resolveEmulatedPath({ root, provided: dir });

      return await searchCode.run({ path: absolute, query, maxResults: effectiveMaxResults });
    }

    if (cmd.startsWith("rg ")) {
      // Attempt: rg -n "query" <dir>
      const match = cmd.match(/rg\s+(?:-n\s+)?(["'])(.+?)\1\s*(.*)$/);
      const query = match ? match[2] : "";
      const dir = match ? match[3].trim() : ".";

      const { absolute } = resolveEmulatedPath({ root, provided: dir });

      return await searchCode.run({ path: absolute, query, maxResults: effectiveMaxResults });
    }

    if (cmd.startsWith("ls")) {
      // ls [-la] [path]
      const tokens = cmd.split(/\s+/).filter(Boolean);
      const target = tokens.find((t, idx) => idx > 0 && !t.startsWith("-"));
      const { absolute } = resolveEmulatedPath({ root, provided: target || "." });
      const stat = await fs.stat(absolute);
      if (!stat.isDirectory()) {
        return { ok: true, emulated: "ls", files: [path.relative(root, absolute)] };
      }
      const entries = await fs.readdir(absolute, { withFileTypes: true });
      const names = entries.map((e) => e.name);
      return {
        ok: true,
        emulated: "ls",
        cwd: path.relative(root, absolute) || ".",
        files: names.slice(0, Math.max(1, Math.trunc(effectiveMaxResults))),
        truncated: names.length > effectiveMaxResults,
      };
    }

    if (cmd.startsWith("cat ")) {
      const { filePath } = parseCat(cmd);
      // Ensure filePath is inside root via readFile tool (which calls resolveRepoPath/ensurePathInside theoretically? No, it calls readFile.run)
      // readFile.run handles it.
      return await readFile.run({ repoPath: root, filePath });
    }

    return {
      ok: false,
      error:
        "execute_bash is a safe emulation only (no real shell). Supported: find, grep -r, rg, ls, cat. Use list_files/search_code/git_grep/read_file for reliable behavior.",
    };
  },
};
