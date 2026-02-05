import { McpClient } from "@numezis/mcp-client/client";
import path from "node:path";
import fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function getWorkingFolderFallback(): Promise<string | null> {
    const envPath =
        process.env.WORKING_FOLDER ||
        process.env.WORKSPACE_PATH ||
        process.env.MCP_DEFAULT_DIR;
    if (envPath) {
        const resolved = path.resolve(envPath);
        if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
            return resolved;
        }
    }

    try {
        const configDir = path.resolve(process.cwd(), "config");
        const configJsonPath = path.join(configDir, "config.json");
        if (!fs.existsSync(configJsonPath)) return null;
        const raw = fs.readFileSync(configJsonPath, "utf-8");
        const data = JSON.parse(raw) as { workingFolder?: string; workspaceRoots?: string[] };
        const candidate = data.workingFolder?.trim()
            ? data.workingFolder
            : Array.isArray(data.workspaceRoots) && data.workspaceRoots.length > 0
                ? data.workspaceRoots[0]
                : "";
        if (!candidate) return null;
        const resolved = path.resolve(candidate);
        if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
            return resolved;
        }
    } catch {
        // ignore
    }
    return null;
}

function normalizeTargetPath(targetPath: string, cwd: string): string | undefined {
    const trimmed = targetPath?.trim() ?? "";
    if (!trimmed) return undefined;
    if (path.isAbsolute(trimmed)) {
        const rel = path.relative(cwd, trimmed);
        return rel === "" ? "." : rel;
    }
    return trimmed;
}

async function runGit(cwd: string, args: string[]): Promise<string> {
    const { stdout } = await execFileAsync("git", args, {
        cwd,
        maxBuffer: 10 * 1024 * 1024,
    });
    return stdout ?? "";
}

async function getCommitsViaGit(
    targetPath: string,
    sinceISO: string,
    untilISO: string
): Promise<CommitInfo[]> {
    const cwd = await getWorkingFolderFallback();
    if (!cwd) {
        console.warn("[gitLocalService] No working folder configured for git fallback.");
        return [];
    }

    const relPath = normalizeTargetPath(targetPath, cwd);
    const format = "%H%x1f%an%x1f%ad%x1f%s%x1e";
    const args = [
        "log",
        `--since=${sinceISO}`,
        `--until=${untilISO}`,
        "--date=iso-strict",
        `--pretty=format:${format}`,
    ];
    if (relPath) {
        args.push("--", relPath);
    }

    try {
        const output = await runGit(cwd, args);
        const records = output.split("\x1e").filter((r) => r.trim().length > 0);
        const history: CommitInfo[] = records.map((record) => {
            const [sha, author, date, message] = record.split("\x1f");
            return { sha, author, date, message };
        });

        // Check for uncommitted changes
        try {
            const diffArgs = ["diff"];
            if (relPath) diffArgs.push("--", relPath);
            const workingDiff = await runGit(cwd, diffArgs);
            if (workingDiff.trim().length > 0) {
                history.unshift({
                    sha: "UNCOMMITTED",
                    author: "Local User",
                    date: new Date().toISOString(),
                    message: "Working Tree Changes (Uncommitted)",
                    isWorkingTree: true,
                });
            }
        } catch (e: any) {
            console.error("[gitLocalService] Failed to check uncommitted changes via git:", e?.message ?? e);
        }

        return history;
    } catch (e: any) {
        console.error("[gitLocalService] git log fallback failed:", e?.message ?? e);
        return [];
    }
}

async function getDiffForCommitViaGit(sha: string, targetPath: string): Promise<string> {
    const cwd = await getWorkingFolderFallback();
    if (!cwd) {
        return "Error: working folder not configured";
    }
    const relPath = normalizeTargetPath(targetPath, cwd);
    const args: string[] = ["diff"];
    if (sha !== "UNCOMMITTED") {
        args.push(`${sha}~1`, sha);
    }
    if (relPath) {
        args.push("--", relPath);
    }
    try {
        return await runGit(cwd, args);
    } catch (e: any) {
        const message = e?.message ?? String(e);
        console.error("[gitLocalService] git diff fallback failed:", message);
        return `Error: ${message}`;
    }
}

/** One commit entry returned from `git log`. */
export interface CommitInfo {
    sha: string;
    author: string;
    date: string; // ISO string
    message: string;
    isWorkingTree?: boolean;
}

/** Full diff payload for a commit. */
export interface DiffChunk extends CommitInfo {
    diff: string; // unified diff (text)
}

/**
 * Get commits that touched `targetPath` between `sinceISO` and `untilISO`.
 * HYBRID STRATEGY: Tries backend filtering, but strictly enforces client-side filtering 
 * to handle stale MCP server versions.
 */
export async function getCommits(
    targetPath: string,
    sinceISO: string,
    untilISO: string
): Promise<CommitInfo[]> {
    try {
        const mcp = await McpClient.getInstance();
        const filePath = targetPath?.trim() === "" ? undefined : targetPath;

        // Fetch a large batch. Stale servers ignore since/until but respect maxCount.
        // Updated servers use since/until to optimize.
        const resultRaw = await mcp.callTool("git_log", {
            filePath,
            since: sinceISO,
            until: untilISO,
            maxCount: 200 // Ensure we get enough history if backend filtering fails
        });

        let commits: any[] = [];
        try {
            commits = JSON.parse(resultRaw);
        } catch (e) {
            console.error("Failed to parse git_log JSON:", resultRaw.slice(0, 100));
            return await getCommitsViaGit(targetPath, sinceISO, untilISO);
        }

        if (!Array.isArray(commits)) {
            return await getCommitsViaGit(targetPath, sinceISO, untilISO);
        }

        const start = new Date(sinceISO).getTime();
        const end = new Date(untilISO).getTime();

        // CLIENT-SIDE FILTERING (Required if server is stale)
        const history: CommitInfo[] = commits
            .map((c: any) => ({
                sha: c.hash,
                author: c.authorName,
                date: c.date,
                message: c.subject
            }))
            .filter((c) => {
                const t = new Date(c.date).getTime();
                return t >= start && t <= end;
            });

        console.log(`[gitLocalService] Logic: fetched ${commits.length} commits, matched ${history.length} in window.`);

        // 2. Always check for Working Tree Changes
        try {
            console.log('[gitLocalService] Checking for uncommitted changes, path:', filePath);
            const workingDiffRaw = await mcp.callTool("git_diff", {
                filePath
            });

            console.log('[gitLocalService] git_diff raw response type:', typeof workingDiffRaw);
            console.log('[gitLocalService] git_diff raw response preview:',
                typeof workingDiffRaw === 'string' ? workingDiffRaw.slice(0, 200) : JSON.stringify(workingDiffRaw).slice(0, 200));

            let workingDiffData: any;
            try {
                workingDiffData = typeof workingDiffRaw === "string" ? JSON.parse(workingDiffRaw) : workingDiffRaw;
            } catch {
                workingDiffData = { diff: workingDiffRaw };
            }

            console.log('[gitLocalService] Parsed diff length:', workingDiffData?.diff?.length || 0);

            if (workingDiffData?.diff && workingDiffData.diff.trim().length > 0) {
                // Always show uncommitted changes (no time gating)
                history.unshift({
                    sha: "UNCOMMITTED",
                    author: "Local User",
                    date: new Date().toISOString(),
                    message: "Working Tree Changes (Uncommitted)",
                    isWorkingTree: true
                });
            } else {
                console.log('[gitLocalService] ⚠️ No diff content detected');
            }
        } catch (e: any) {
            console.error('[gitLocalService] ❌ Error checking uncommitted changes:', e.message);
        }

        return history;
    } catch (error: any) {
        console.error('getCommits via MCP failed:', error.message);
        return await getCommitsViaGit(targetPath, sinceISO, untilISO);
    }
}

/**
 * Retrieve the unified diff for a single commit or the working tree.
 */
export async function getDiffForCommit(
    sha: string,
    targetPath: string
): Promise<string> {
    try {
        const mcp = await McpClient.getInstance();
        const filePath = targetPath?.trim() === "" ? undefined : targetPath;

        if (sha === "UNCOMMITTED") {
            const res = await mcp.callTool("git_diff", { filePath });
            try {
                const data = typeof res === "string" ? JSON.parse(res) : res;
                return data.diff || "";
            } catch {
                return typeof res === "string" ? res : "";
            }
        }

        const res = await mcp.callTool("git_diff", {
            from: `${sha}~1`,
            to: sha,
            filePath
        });

        try {
            const data = typeof res === "string" ? JSON.parse(res) : res;
        return data.diff || "";
    } catch {
        return typeof res === "string" ? res : "";
    }
    } catch (error: any) {
        console.error('getDiffForCommit via MCP failed:', error.message);
        return await getDiffForCommitViaGit(sha, targetPath);
    }
}

/**
 * High-level helper.
 */
export async function getDiffsForWindow(
    targetPath: string,
    sinceISO: string,
    untilISO: string
): Promise<DiffChunk[]> {
    const commits = await getCommits(targetPath, sinceISO, untilISO);
    const limitedCommits = commits.slice(0, 30);

    return await Promise.all(
        limitedCommits.map(async c => ({
            ...c,
            diff: await getDiffForCommit(c.sha, targetPath),
        }))
    );
}
