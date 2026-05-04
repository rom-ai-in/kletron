/**
 * When POST /sessions/:id/edits/approve replays a tool through {@link McpClient}, some deployments
 * expose a filtered MCP tool list that omits bundled writes — approval then fails with
 * "Tool not found" (-32603). This module re-implements the same safety rules as
 * apps/mcp-server/tools/writeFile.js using the workspace root from the run (no MCP config).
 */

import fs from "node:fs/promises";
import path from "node:path";

const MAX_FILE_SIZE_BYTES = 256 * 1024;
const BLOCKED_EXTENSIONS = new Set([".env", ".DS_Store"]);
const BLOCKED_FILENAMES = new Set([".git", ".env", ".npmrc", "package-lock.json", "yarn.lock"]);

function ensurePathInsideWorkspaceRoot(workspaceRoot: string, resolvedTarget: string): void {
    const root = path.resolve(workspaceRoot);
    const target = path.resolve(resolvedTarget);
    const rel = path.relative(root, target);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
        throw new Error("Resolved path is outside the workspace root.");
    }
}

function enforceWritePolicyBasename(resolvedFilePath: string): void {
    const basename = path.basename(resolvedFilePath);
    if (BLOCKED_FILENAMES.has(basename)) {
        throw new Error(`Security: Writing to sensitive file '${basename}' is blocked.`);
    }
    if (basename.startsWith(".") && basename !== ".gitignore" && basename !== ".npmignore") {
        throw new Error("Security: Writing to dotfiles is blocked by default.");
    }
    const ext = path.extname(resolvedFilePath);
    if (BLOCKED_EXTENSIONS.has(ext)) {
        throw new Error(`Security: Writing to file type '${ext}' is blocked.`);
    }
}

export function isMcpBundledToolNotFoundError(err: unknown): boolean {
    const msg = String((err as Error)?.message ?? err ?? "");
    return (
        /tool not found/i.test(msg) ||
        /-32603/i.test(msg) ||
        /unknown tool/i.test(msg)
    );
}

/**
 * Execute write_file with the same policies as the bundled MCP tool, scoped to `workspaceRoot`.
 */
export async function invokeWriteFileApprovalFallback(
    workspaceRoot: string,
    args: Record<string, unknown>
): Promise<string> {
    const root = path.resolve(workspaceRoot);
    const repoPathRaw = args.repoPath;
    const effectiveRoot =
        typeof repoPathRaw === "string" && repoPathRaw.trim()
            ? path.resolve(String(repoPathRaw))
            : root;
    ensurePathInsideWorkspaceRoot(root, effectiveRoot);

    const filePath = args.filePath;
    const content = args.content;
    if (typeof filePath !== "string") {
        throw new Error("write_file requires filePath");
    }
    if (typeof content !== "string") {
        throw new Error("write_file requires content");
    }
    const createDirs = args.createDirs !== false;
    const overwrite = args.overwrite !== false;

    const resolvedFilePath = path.isAbsolute(filePath)
        ? path.resolve(filePath)
        : path.resolve(effectiveRoot, filePath);

    ensurePathInsideWorkspaceRoot(root, resolvedFilePath);

    const basename = path.basename(resolvedFilePath);
    if (BLOCKED_FILENAMES.has(basename)) {
        throw new Error(`Security: Writing to sensitive file '${basename}' is blocked.`);
    }
    if (basename.startsWith(".") && basename !== ".gitignore" && basename !== ".npmignore") {
        throw new Error("Security: Writing to dotfiles is blocked by default.");
    }
    const ext = path.extname(resolvedFilePath);
    if (BLOCKED_EXTENSIONS.has(ext)) {
        throw new Error(`Security: Writing to file type '${ext}' is blocked.`);
    }
    if (Buffer.byteLength(content, "utf8") > MAX_FILE_SIZE_BYTES) {
        throw new Error(`Security: File content exceeds maximum allowed size of ${MAX_FILE_SIZE_BYTES} bytes.`);
    }

    if (!overwrite) {
        try {
            await fs.access(resolvedFilePath);
            throw new Error(`File already exists: ${filePath}`);
        } catch (error: unknown) {
            const code = (error as NodeJS.ErrnoException)?.code;
            if (code !== "ENOENT") throw error;
        }
    }

    if (createDirs) {
        await fs.mkdir(path.dirname(resolvedFilePath), { recursive: true });
    }

    await fs.writeFile(resolvedFilePath, content, "utf8");
    const out = {
        ok: true,
        filePath: path.relative(root, resolvedFilePath),
    };
    return JSON.stringify(out, null, 2);
}

/**
 * Replay `str_replace_editor` **str_replace** when MCP returns tool-not-found (-32603).
 * Mirrors apps/mcp-server/tools/strReplaceEditor.js safety rules without MCP config/workspaceRoots.
 */
export async function invokeStrReplaceEditorApprovalFallback(
    workspaceRoot: string,
    args: Record<string, unknown>
): Promise<string> {
    const root = path.resolve(workspaceRoot);
    const repoPathRaw = args.repoPath;
    const effectiveRepo =
        typeof repoPathRaw === "string" && repoPathRaw.trim() ? path.resolve(String(repoPathRaw)) : root;
    ensurePathInsideWorkspaceRoot(root, effectiveRepo);

    const cmdRaw = args.command ?? args.action ?? args.operation ?? "str_replace";
    const cmd = String(cmdRaw).trim().toLowerCase();
    const normalized = cmd === "read" ? "view" : cmd === "replace" ? "str_replace" : cmd;

    if (normalized !== "str_replace") {
        throw new Error(
            `str_replace_editor approval fallback only supports str_replace (got ${String(cmdRaw)})`
        );
    }

    const targetRaw = args.path ?? args.filePath;
    const target = typeof targetRaw === "string" ? targetRaw.trim() : "";
    if (!target) throw new Error("str_replace_editor requires path or filePath");

    const resolvedFilePath = path.isAbsolute(target)
        ? path.resolve(target)
        : path.resolve(effectiveRepo, target);

    ensurePathInsideWorkspaceRoot(root, resolvedFilePath);
    enforceWritePolicyBasename(resolvedFilePath);

    const oldStr = args.old_str;
    const newStr = args.new_str;
    if (typeof oldStr !== "string" || typeof newStr !== "string") {
        throw new Error("str_replace requires old_str and new_str");
    }
    if (oldStr === newStr) {
        return JSON.stringify({ ok: false, error: "old_str and new_str are identical." }, null, 2);
    }
    if (!oldStr.length) {
        throw new Error("old_str cannot be empty.");
    }

    let content: string;
    try {
        content = await fs.readFile(resolvedFilePath, "utf8");
    } catch (e: unknown) {
        const code = (e as NodeJS.ErrnoException)?.code;
        if (code === "ENOENT") {
            return JSON.stringify(
                { ok: false, error: `File not found: ${path.relative(root, resolvedFilePath)}` },
                null,
                2
            );
        }
        throw e;
    }

    const replacedPreview = content.replace(oldStr, newStr);
    const resultSize = Buffer.byteLength(replacedPreview, "utf8");
    if (resultSize > MAX_FILE_SIZE_BYTES) {
        throw new Error(`Security: Result would exceed maximum allowed size of ${MAX_FILE_SIZE_BYTES} bytes.`);
    }

    const occurrences = content.split(oldStr).length - 1;
    if (occurrences === 0) {
        return JSON.stringify(
            {
                ok: false,
                error: `No match found for old_str in ${path.relative(root, resolvedFilePath)}.`,
            },
            null,
            2
        );
    }
    if (occurrences > 1) {
        return JSON.stringify(
            {
                ok: false,
                error: `Found ${occurrences} occurrences; str_replace requires exactly one match.`,
            },
            null,
            2
        );
    }

    await fs.writeFile(resolvedFilePath, replacedPreview, "utf8");

    const replacementIndex = content.indexOf(oldStr);
    const lineNumber = content.slice(0, replacementIndex).split("\n").length;

    return JSON.stringify(
        {
            ok: true,
            file: path.relative(root, resolvedFilePath),
            message: `Replacement applied at line ${lineNumber}.`,
        },
        null,
        2
    );
}
