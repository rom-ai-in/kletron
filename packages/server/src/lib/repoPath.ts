import { McpClient } from "@numezis/mcp-client/client";
import { TargetFile } from "@numezis/shared/agentSchemas";

/**
 * Checks if a file exists in the repository using the MCP `read_file` tool.
 * Considers ENOENT/not found errors as non-existence.
 * Other errors (permissions, etc.) are thrown.
 */
export async function fileExistsViaMcp(filePath: string): Promise<boolean> {
    const client = await McpClient.getInstance();
    try {
        // We try to read the file. If it fails with "no such file" or similar, it doesn't exist.
        // Ideally we would have a file_exists tool, but read_file is the standard primitive here.
        const result = await client.callTool("read_file", { filePath });

        // Check for string error messages returned by the tool (not thrown)
        if (typeof result === "string") {
            const lower = result.toLowerCase();
            if (lower.includes("no such file") || lower.includes("enoent") || lower.includes("does not exist")) {
                return false;
            }
        }

        // Check for explicit error object if the tool returns structured error
        if (result && typeof result === "object" && "error" in result) {
            const err = (result as any).error;
            if (typeof err === "string") {
                const lower = err.toLowerCase();
                if (lower.includes("no such file") || lower.includes("enoent")) {
                    return false;
                }
            }
        }

        return true;
    } catch (error) {
        const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
        if (msg.includes("no such file") || msg.includes("enoent")) {
            return false;
        }
        // Re-throw other errors (connectivity, permissions, etc)
        throw error;
    }
}

export interface ValidationResult {
    validTargets: TargetFile[];
    droppedTargets: Array<{ path: string; reason: string }>;
}

/**
 * Validates a list of target files from Phase 2.
 * 1. Enforces repo-relative paths (no absolute paths / leading slashes if possible, though ./ is okay).
 * 2. Checks existence via MCP.
 * 3. Returns valid and dropped targets.
 */
export async function normalizeAndValidateTargetFiles(
    targets: TargetFile[]
): Promise<ValidationResult> {
    const validTargets: TargetFile[] = [];
    const droppedTargets: Array<{ path: string; reason: string }> = [];

    for (const target of targets) {
        // Basic normalization
        let p = target.path.trim();

        // Remove leading slash to make it repo-relative
        if (p.startsWith("/")) {
            p = p.substring(1);
        }
        // Remove ./ prefix
        if (p.startsWith("./")) {
            p = p.substring(2);
        }

        // Check constraints
        if (p.includes("..")) {
            droppedTargets.push({ path: target.path, reason: "Path traversal detected" });
            continue;
        }

        const exists = await fileExistsViaMcp(p);
        if (exists) {
            validTargets.push({ ...target, path: p });
        } else {
            droppedTargets.push({ path: target.path, reason: "File does not exist" });
        }
    }

    return { validTargets, droppedTargets };
}
