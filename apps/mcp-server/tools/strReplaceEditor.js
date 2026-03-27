import fs from "fs/promises";
import path from "path";

import { ensurePathInside, resolveRepoPath } from "./pathUtils.js";
import { readFileRange } from "./readFileRange.js";

// ═══════════════════════════════════════════════════════════════════════════
// Security policies (aligned with writeFile.js)
// ═══════════════════════════════════════════════════════════════════════════
const MAX_FILE_SIZE_BYTES = 256 * 1024; // 256KB
const BLOCKED_EXTENSIONS = [".env", ".DS_Store"];
const BLOCKED_FILENAMES = [".git", ".env", ".npmrc", "package-lock.json", "yarn.lock"];

function enforceWritePolicy(resolvedFilePath, resolvedRoot) {
  const basename = path.basename(resolvedFilePath);
  if (BLOCKED_FILENAMES.includes(basename)) {
    throw new Error(`Security: Writing to sensitive file '${basename}' is blocked.`);
  }
  if (basename.startsWith(".") && basename !== ".gitignore" && basename !== ".npmignore") {
    throw new Error("Security: Writing to dotfiles is blocked by default.");
  }
  const ext = path.extname(resolvedFilePath);
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    throw new Error(`Security: Writing to file type '${ext}' is blocked.`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Undo stack — single-level, in-memory, per file path
// ═══════════════════════════════════════════════════════════════════════════
const undoStack = new Map();

function saveUndo(resolvedPath, content) {
  undoStack.set(resolvedPath, content);
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function normalizeCommand(raw) {
  const value = (raw || "").toString().trim().toLowerCase();
  if (!value) return "view";
  // Aliases
  if (value === "read") return "view";
  if (value === "replace") return "str_replace";
  return value;
}

function resolvePath(root, target) {
  return path.isAbsolute(target) ? path.resolve(target) : path.resolve(root, target);
}

// ═══════════════════════════════════════════════════════════════════════════
// Commands
// ═══════════════════════════════════════════════════════════════════════════

async function cmdView(root, resolvedFilePath, { startLine, endLine, maxBytes = 500_000 }) {
  try {
    const stat = await fs.stat(resolvedFilePath);
    if (stat.isDirectory()) {
      return {
        ok: false,
        error: "Target is a directory. Use `list_files` to inspect directories.",
      };
    }
  } catch {
    // Let read attempts surface their own error.
  }

  if (Number.isFinite(startLine) && Number.isFinite(endLine)) {
    return await readFileRange.run({
      repoPath: root,
      filePath: path.relative(root, resolvedFilePath),
      startLine,
      endLine,
    });
  }

  const handle = await fs.open(resolvedFilePath, "r");
  try {
    const stat = await handle.stat();
    const size = Math.min(stat.size, Math.max(1_000, Math.trunc(maxBytes)));
    const buffer = Buffer.alloc(size);
    await handle.read(buffer, 0, size, 0);
    const text = buffer.toString("utf-8");
    const truncated = size < stat.size;

    // Add line numbers for consistency with Anthropic's format
    const lines = text.split("\n");
    const numbered = lines.map((line, i) => `${i + 1}\t${line}`).join("\n");

    return {
      file: path.relative(root, resolvedFilePath),
      truncated,
      bytes: size,
      totalLines: lines.length,
      text: numbered,
    };
  } finally {
    await handle.close();
  }
}

async function cmdCreate(root, resolvedFilePath, { file_text }) {
  enforceWritePolicy(resolvedFilePath, root);

  if (typeof file_text !== "string") {
    return { ok: false, error: "Missing `file_text` parameter. Provide the file contents to create." };
  }

  if (Buffer.byteLength(file_text, "utf8") > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: `File content exceeds maximum allowed size of ${MAX_FILE_SIZE_BYTES} bytes.` };
  }

  // Check if file already exists
  try {
    await fs.access(resolvedFilePath);
    return {
      ok: false,
      error: `File already exists: ${path.relative(root, resolvedFilePath)}. Use str_replace to edit existing files, or write_file with overwrite=true to replace entirely.`,
    };
  } catch (e) {
    if (e?.code !== "ENOENT") throw e;
  }

  // Create parent directories
  await fs.mkdir(path.dirname(resolvedFilePath), { recursive: true });
  await fs.writeFile(resolvedFilePath, file_text, "utf-8");

  return {
    ok: true,
    file: path.relative(root, resolvedFilePath),
    message: `File created successfully (${file_text.split("\n").length} lines).`,
  };
}

async function cmdStrReplace(root, resolvedFilePath, { old_str, new_str }) {
  enforceWritePolicy(resolvedFilePath, root);

  if (typeof old_str !== "string") {
    return { ok: false, error: "Missing `old_str` parameter. Provide the exact text to replace." };
  }
  if (typeof new_str !== "string") {
    return { ok: false, error: "Missing `new_str` parameter. Provide the replacement text." };
  }
  if (old_str === new_str) {
    return { ok: false, error: "`old_str` and `new_str` are identical. No change needed." };
  }
  if (old_str.length === 0) {
    return { ok: false, error: "`old_str` cannot be empty. Use `insert` command to add new content." };
  }

  let content;
  try {
    content = await fs.readFile(resolvedFilePath, "utf-8");
  } catch (e) {
    return { ok: false, error: `File not found: ${path.relative(root, resolvedFilePath)}` };
  }

  // Enforce content size
  const resultSize = Buffer.byteLength(content.replace(old_str, new_str), "utf8");
  if (resultSize > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: `Resulting file would exceed maximum allowed size of ${MAX_FILE_SIZE_BYTES} bytes.` };
  }

  // Count occurrences
  const occurrences = content.split(old_str).length - 1;
  if (occurrences === 0) {
    // Provide helpful context: show similar lines
    const lines = content.split("\n");
    const searchTerms = old_str.split("\n")[0].trim();
    const similar = lines
      .map((line, i) => ({ line: line.trim(), num: i + 1 }))
      .filter((l) => l.line && searchTerms && l.line.includes(searchTerms.slice(0, 20)))
      .slice(0, 3);

    let hint = "";
    if (similar.length > 0) {
      hint = `\nDid you mean one of these lines?\n${similar.map((s) => `  L${s.num}: ${s.line}`).join("\n")}`;
    }
    return {
      ok: false,
      error: `No match found for old_str in ${path.relative(root, resolvedFilePath)}.${hint}\n\nMake sure the text matches exactly (including whitespace and indentation). Use view command to check the file content.`,
    };
  }
  if (occurrences > 1) {
    return {
      ok: false,
      error: `Found ${occurrences} occurrences of old_str in ${path.relative(root, resolvedFilePath)}. The str_replace command requires exactly 1 match for safety. Include more surrounding context in old_str to make the match unique.`,
    };
  }

  // Save undo state
  saveUndo(resolvedFilePath, content);

  // Perform replacement
  const newContent = content.replace(old_str, new_str);
  await fs.writeFile(resolvedFilePath, newContent, "utf-8");

  // Build a snippet showing surroundings
  const replacementIndex = content.indexOf(old_str);
  const lineNumber = content.slice(0, replacementIndex).split("\n").length;

  return {
    ok: true,
    file: path.relative(root, resolvedFilePath),
    message: `Replacement applied at line ${lineNumber}.`,
    linesReplaced: old_str.split("\n").length,
    linesInserted: new_str.split("\n").length,
  };
}

async function cmdInsert(root, resolvedFilePath, { insert_line, new_str }) {
  enforceWritePolicy(resolvedFilePath, root);

  if (typeof insert_line !== "number" || !Number.isFinite(insert_line)) {
    return { ok: false, error: "Missing or invalid `insert_line` parameter. Provide the line number after which to insert." };
  }
  if (typeof new_str !== "string") {
    return { ok: false, error: "Missing `new_str` parameter. Provide the text to insert." };
  }

  let content;
  try {
    content = await fs.readFile(resolvedFilePath, "utf-8");
  } catch (e) {
    return { ok: false, error: `File not found: ${path.relative(root, resolvedFilePath)}` };
  }

  const lines = content.split("\n");
  if (insert_line < 0 || insert_line > lines.length) {
    return {
      ok: false,
      error: `insert_line ${insert_line} is out of range. File has ${lines.length} lines (valid: 0 to ${lines.length}).`,
    };
  }

  // Save undo state
  saveUndo(resolvedFilePath, content);

  // Insert after the specified line (0 = insert at beginning)
  const newLines = new_str.split("\n");
  lines.splice(insert_line, 0, ...newLines);
  const newContent = lines.join("\n");

  if (Buffer.byteLength(newContent, "utf8") > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: `Resulting file would exceed maximum allowed size of ${MAX_FILE_SIZE_BYTES} bytes.` };
  }

  await fs.writeFile(resolvedFilePath, newContent, "utf-8");

  return {
    ok: true,
    file: path.relative(root, resolvedFilePath),
    message: `Inserted ${newLines.length} line(s) after line ${insert_line}.`,
  };
}

async function cmdUndoEdit(root, resolvedFilePath) {
  const previousContent = undoStack.get(resolvedFilePath);
  if (previousContent === undefined) {
    return {
      ok: false,
      error: `No undo history for ${path.relative(root, resolvedFilePath)}. Only one level of undo is supported, and only within the current session.`,
    };
  }

  // Save current state for potential re-undo
  let currentContent;
  try {
    currentContent = await fs.readFile(resolvedFilePath, "utf-8");
  } catch {
    currentContent = undefined;
  }

  await fs.writeFile(resolvedFilePath, previousContent, "utf-8");
  undoStack.delete(resolvedFilePath);

  // Store current content as new undo target (allows toggling)
  if (currentContent !== undefined) {
    saveUndo(resolvedFilePath, currentContent);
  }

  return {
    ok: true,
    file: path.relative(root, resolvedFilePath),
    message: "Last edit undone successfully.",
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Exported tool
// ═══════════════════════════════════════════════════════════════════════════

export const strReplaceEditor = {
  description:
    "File editor tool supporting view, create, str_replace, insert, and undo_edit commands. " +
    "Use str_replace for surgical edits (replaces exactly one unique occurrence of old_str with new_str). " +
    "Use create for new files. Use insert to add lines after a specific line number.",
  inputSchema: {
    type: "object",
    properties: {
      repoPath: { type: "string", description: "Repository root (optional if defaultDir is configured)." },
      command: {
        type: "string",
        enum: ["view", "create", "str_replace", "insert", "undo_edit"],
        description: "The command to execute: view, create, str_replace, insert, or undo_edit.",
      },
      // Legacy aliases for command
      action: { type: "string", description: "Alias for `command` (backward compat)." },
      operation: { type: "string", description: "Alias for `command` (backward compat)." },
      // Target file
      path: { type: "string", description: "File path (absolute or relative to repo root)." },
      filePath: { type: "string", description: "Alias for `path`." },
      // str_replace parameters
      old_str: { type: "string", description: "The exact text to replace (must match once). Required for str_replace." },
      new_str: { type: "string", description: "Replacement text. Required for str_replace and insert." },
      // create parameter
      file_text: { type: "string", description: "Full file content. Required for create." },
      // insert parameter
      insert_line: { type: "number", description: "Line number after which to insert (0 = beginning). Required for insert." },
      // view parameters
      startLine: { type: "number", description: "Optional 1-based start line (inclusive) for view range." },
      endLine: { type: "number", description: "Optional 1-based end line (inclusive) for view range." },
      maxBytes: { type: "number", description: "Optional safety cap for full-file view reads." },
      // Additional aliases for Anthropic compatibility
      view_range: {
        type: "array",
        items: { type: "number" },
        description: "Optional [startLine, endLine] array for view command.",
      },
    },
  },
  async run({
    repoPath,
    command,
    action,
    operation,
    path: providedPath,
    filePath,
    old_str,
    new_str,
    file_text,
    insert_line,
    startLine,
    endLine,
    maxBytes = 500_000,
    view_range,
  } = {}) {
    const root = resolveRepoPath(repoPath);
    const target = (providedPath || filePath || "").toString();

    if (!target) {
      return {
        ok: false,
        error:
          "Missing path/filePath parameter. Specify the file to operate on.",
      };
    }

    const resolvedFilePath = resolvePath(root, target);
    ensurePathInside(root, resolvedFilePath);

    // Resolve command from multiple possible parameter names
    const cmd = normalizeCommand(command || action || operation);

    // Handle view_range alias
    if (cmd === "view" && Array.isArray(view_range) && view_range.length === 2) {
      startLine = view_range[0];
      endLine = view_range[1];
    }

    switch (cmd) {
      case "view":
        return cmdView(root, resolvedFilePath, { startLine, endLine, maxBytes });
      case "create":
        return cmdCreate(root, resolvedFilePath, { file_text });
      case "str_replace":
        return cmdStrReplace(root, resolvedFilePath, { old_str, new_str });
      case "insert":
        return cmdInsert(root, resolvedFilePath, { insert_line, new_str });
      case "undo_edit":
        return cmdUndoEdit(root, resolvedFilePath);
      default:
        return {
          ok: false,
          error: `Unknown command: "${cmd}". Valid commands: view, create, str_replace, insert, undo_edit.`,
        };
    }
  },
};
