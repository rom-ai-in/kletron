import { McpClient } from "../mcp/client";

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
            return [];
        }

        if (!Array.isArray(commits)) return [];

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
        throw error;
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
        return `Error: ${error.message}`;
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
