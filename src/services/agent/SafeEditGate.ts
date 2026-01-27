
import { v4 as uuidv4 } from "uuid";

export type PendingEdit = {
    id: string;
    conversationId: string;
    toolName: string;
    args: Record<string, any>;
    status: "pending" | "approved" | "rejected";
    createdAt: string;
    description?: string;
};

// Use globalThis to persist singleton across Next.js HMR reloads
const globalForGate = globalThis as unknown as { safeEditGate?: SafeEditGate };

export class SafeEditGate {
    private pendingEdits: Map<string, PendingEdit> = new Map();

    private constructor() { }

    static getInstance(): SafeEditGate {
        if (!globalForGate.safeEditGate) {
            globalForGate.safeEditGate = new SafeEditGate();
            console.log("[SafeEditGate] Created new singleton instance");
        }
        return globalForGate.safeEditGate;
    }

    /**
     * Proposes an edit and returns a unique ID for the pending operation.
     * Throws an error to interrupt the agent flow (the agent should catch this and wait for approval).
     */
    proposeEdit(conversationId: string, toolName: string, args: Record<string, any>, description?: string): PendingEdit {
        const id = uuidv4();
        const edit: PendingEdit = {
            id,
            conversationId,
            toolName,
            args,
            status: "pending",
            createdAt: new Date().toISOString(),
            description
        };
        this.pendingEdits.set(id, edit);
        console.log(`[SafeEditGate] Proposed edit ${id} for ${conversationId}, total pending: ${this.pendingEdits.size}`);
        return edit;
    }

    getPendingEdit(id: string): PendingEdit | undefined {
        return this.pendingEdits.get(id);
    }

    listPendingEdits(conversationId?: string): PendingEdit[] {
        const edits = Array.from(this.pendingEdits.values());
        if (conversationId) {
            return edits.filter(e => e.conversationId === conversationId && e.status === "pending");
        }
        return edits.filter(e => e.status === "pending");
    }

    approveEdit(id: string): PendingEdit {
        const edit = this.pendingEdits.get(id);
        if (!edit) throw new Error("Edit not found");
        // In a real persistent system, we might update DB.
        // For now, we update in-memory state.
        edit.status = "approved";
        // We clean up from pending map or keep it as history? 
        // Let's keep it but it won't show up in listPendingEdits
        return edit;
    }

    rejectEdit(id: string): PendingEdit {
        const edit = this.pendingEdits.get(id);
        if (!edit) throw new Error("Edit not found");
        edit.status = "rejected";
        return edit;
    }

    /**
     * Approve all pending edits for a conversation.
     * Returns the list of approved edits.
     */
    approveAll(conversationId: string): PendingEdit[] {
        const edits = this.listPendingEdits(conversationId);
        for (const edit of edits) {
            edit.status = "approved";
        }
        return edits;
    }

    /**
     * Reject all pending edits for a conversation.
     * Returns the list of rejected edits.
     */
    rejectAll(conversationId: string): PendingEdit[] {
        const edits = this.listPendingEdits(conversationId);
        for (const edit of edits) {
            edit.status = "rejected";
        }
        return edits;
    }

    /**
     * Get all edits (including approved/rejected) for a conversation.
     */
    listAllEdits(conversationId: string): PendingEdit[] {
        return Array.from(this.pendingEdits.values())
            .filter(e => e.conversationId === conversationId);
    }
}
