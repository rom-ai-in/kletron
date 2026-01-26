export type AgentId = string;
export type FileId = string; // absolute path

export interface Position {
    line: number;   // 1-based
    column: number; // 0-based NOT SUPPORTED FULLY YET, usually 1-based in Monaco, but let's stick to 1-based for consistency if easier. Actually Monaco is 1-based. Let's say 1-based.
}

export interface CursorState {
    agentId: AgentId;
    fileId: FileId;
    position: Position;
    avatarUrl?: string; // Optional URL for the agent's avatar/icon
    label?: string;     // Display name (e.g. "Drift Analysis")
    color?: string;     // Hex color code
}

export interface DiffChunk {
    startLine: number;   // inclusive (1-based)
    endLine: number;     // inclusive (1-based)
    originalContent?: string[]; // The lines being replaced
    replacementContent?: string[]; // The new lines
}

export interface AgentDiff {
    id: string; // Unique ID for this diff proposal
    agentId: AgentId;
    fileId: FileId;
    chunks: DiffChunk[];
    timestamp: number;
    status: 'pending' | 'approved' | 'rejected' | 'conflict';
}

/**
 * Central store for the editor page.
 */
export interface EditorState {
    /** All files currently opened by any agent */
    openFiles: string[];

    /** Map file -> agents that have it open */
    fileAgents: Record<FileId, AgentId[]>;

    /** Live cursor positions per agent */
    cursors: Record<AgentId, CursorState>;

    /** Diffs that each agent has produced but not yet committed */
    pendingDiffs: Record<FileId, AgentDiff[]>;

    /** System messages or conflict warnings */
    alerts: EditorAlert[];
}

export interface EditorAlert {
    id: string;
    type: 'info' | 'warning' | 'error';
    message: string;
    fileId?: FileId;
    agentId?: AgentId;
}

// API Payloads
export interface ClaimFilePayload {
    fileId: string;
}

export interface ReleaseFilePayload {
    fileId: string;
}

export interface UpdateCursorPayload {
    fileId: string;
    position: Position;
}

export interface ProposeDiffPayload {
    fileId: string;
    chunks: DiffChunk[];
}

export interface CommitDiffPayload {
    fileId: string;
    diffId: string;
}
