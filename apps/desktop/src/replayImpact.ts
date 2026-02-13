/**
 * Pure computation logic for replay impact analysis.
 *
 * Extracted from useConversation so it can be unit-tested without React.
 */

import type { FileChange, ReplayImpact } from "@numezis/ui";

/**
 * Minimal event shape needed by the impact computation.
 * Compatible with the full ChatEvent but avoids coupling to the desktop types.
 */
export interface ReplayEvent {
    kind: string;
    toolName?: string;
    toolArgs?: string;
    messageIndex?: number;
}

/**
 * Compute the impact of replaying from a given message index.
 *
 * Analyses all events after `fromIndex` to find messages, tool calls,
 * and file changes.  Extracts actual code content and builds diff lines
 * where possible.
 */
export function computeReplayImpactPure(
    events: ReplayEvent[],
    fromIndex: number,
    originalContent: string,
    newContent: string
): ReplayImpact {
    const eventsAfter = events.filter(
        (e) => typeof e.messageIndex === "number" && e.messageIndex > fromIndex
    );

    let messagesRemoved = 0;
    let toolCallsRemoved = 0;

    // Track per-file: action, written content, and str_replace edits
    type FileEntry = {
        action: FileChange["action"];
        /** Content from the last write_file call */
        writtenContent?: string;
        /** Accumulated str_replace edits */
        replaceEdits: Array<{ oldStr: string; newStr: string }>;
    };
    const fileEntriesMap = new Map<string, FileEntry>();

    const getOrCreate = (path: string): FileEntry => {
        let entry = fileEntriesMap.get(path);
        if (!entry) {
            entry = { action: "modified", replaceEdits: [] };
            fileEntriesMap.set(path, entry);
        }
        return entry;
    };

    for (const event of eventsAfter) {
        if (event.kind === "user" || (event.kind === "assistant" && !event.toolName)) {
            messagesRemoved++;
        }
        if (event.kind === "assistant" && event.toolName) {
            toolCallsRemoved++;

            // Parse tool args for file changes
            const toolName = event.toolName.toLowerCase();
            let args: Record<string, unknown> = {};
            if (event.toolArgs) {
                try {
                    args = JSON.parse(event.toolArgs);
                } catch {
                    // ignore
                }
            }

            const filePath =
                (args.filePath as string) ??
                (args.path as string) ??
                (args.file_path as string) ??
                (args.fileName as string) ??
                "";

            if (filePath) {
                // Exclude non-filesystem "write" tools (e.g. write_todos)
                const isFileWrite =
                    (toolName.includes("write") || toolName.includes("create") || toolName.includes("save")) &&
                    !toolName.includes("todo");

                if (isFileWrite) {
                    const isNew = !fileEntriesMap.has(filePath);
                    const entry = getOrCreate(filePath);
                    // Only promote action when the entry was just created (first touch)
                    // or still at the default "modified".  Never downgrade "created" to
                    // "modified" if a later write_file call targets the same path.
                    if (isNew || entry.action === "modified") {
                        entry.action = toolName.includes("create") ? "created" : "modified";
                    }
                    // Capture written content
                    const content = args.content;
                    if (typeof content === "string") {
                        entry.writtenContent = content;
                    }
                } else if (toolName.includes("str_replace") || toolName === "str_replace_editor") {
                    const entry = getOrCreate(filePath);
                    const oldStr = (args.old_str ?? args.oldStr ?? args.old_string) as string | undefined;
                    const newStr = (args.new_str ?? args.newStr ?? args.new_string) as string | undefined;
                    if (typeof oldStr === "string" && typeof newStr === "string") {
                        entry.replaceEdits.push({ oldStr, newStr });
                    }
                } else if (toolName.includes("delete") || toolName.includes("remove")) {
                    const entry = getOrCreate(filePath);
                    entry.action = "deleted";
                }
            }
        }
        if (event.kind === "tool") {
            // Tool results don't count as separate tool calls (they're the response)
        }
    }

    // Build FileChange[] with diff content
    const fileChanges: FileChange[] = Array.from(fileEntriesMap.entries()).map(
        ([path, entry]) => {
            const fc: FileChange = { path, action: entry.action };

            // For created files, attach the full content
            if (entry.action === "created" && entry.writtenContent) {
                fc.newContent = entry.writtenContent;
            }

            // For modified files, build diff lines from str_replace edits
            if (entry.action === "modified" && entry.replaceEdits.length > 0) {
                const diffLines: string[] = [];
                for (const edit of entry.replaceEdits) {
                    // Generate a simple unified-style diff for each replacement
                    const oldLines = edit.oldStr.split("\n");
                    const newLines = edit.newStr.split("\n");
                    diffLines.push(`@@ str_replace in ${path.split("/").pop()} @@`);
                    for (const line of oldLines) {
                        diffLines.push(`-${line}`);
                    }
                    for (const line of newLines) {
                        diffLines.push(`+${line}`);
                    }
                }
                fc.diffLines = diffLines;
            }

            // For write_file on modified files (full rewrite), show the new content
            if (entry.action === "modified" && !fc.diffLines && entry.writtenContent) {
                fc.newContent = entry.writtenContent;
            }

            return fc;
        }
    );

    return {
        messagesRemoved,
        toolCallsRemoved,
        fileChanges,
        originalContent,
        newContent,
    };
}
