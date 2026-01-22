import { ObjectId } from "mongodb";
import { getDb } from "../lib/db";
import type { AgentWorkflowResult, TimelineEvent, AgentEvent } from "../agentRunner";

export type AuditSessionStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export interface AuditSession {
    _id?: ObjectId;
    prompt: string;
    status: AuditSessionStatus;
    startedAt: Date;
    endedAt?: Date;
    // Hoisted fields for direct access
    timeline?: TimelineEvent[];
    eventStream?: AgentEvent[];
    outputs?: AgentWorkflowResult["outputs"];
    // Kept for backward compatibility or full result object
    workflowResult?: Partial<AgentWorkflowResult>;
    error?: string;
    lastUpdated: Date;
}

const COLLECTION_NAME = "audit_sessions";

export const auditService = {
    async createSession(prompt: string): Promise<string> {
        try {
            const db = await getDb();
            const session: AuditSession = {
                prompt,
                status: "PENDING",
                startedAt: new Date(),
                lastUpdated: new Date(),
            };

            const result = await db.collection(COLLECTION_NAME).insertOne(session);
            return result.insertedId.toString();
        } catch (error) {
            console.error("Failed to create audit session:", error);
            // We return a dummy ID or handle error gracefully so we don't block the agent
            // if DB is down. For now, returning empty string to signal failure.
            return "";
        }
    },

    async updateSession(id: string, updates: Partial<AgentWorkflowResult>) {
        if (!id) return;
        try {
            const db = await getDb();

            // Extract fields to hoist to root level
            const { timeline, eventStream, outputs, ...rest } = updates;

            const updateDoc: any = {
                status: "RUNNING",
                lastUpdated: new Date()
            };

            if (timeline) updateDoc.timeline = timeline;
            if (eventStream) updateDoc.eventStream = eventStream;
            if (outputs) updateDoc.outputs = outputs;

            await db.collection(COLLECTION_NAME).updateOne(
                { _id: new ObjectId(id) },
                { $set: updateDoc }
            );
        } catch (error) {
            console.error(`Failed to update session ${id}:`, error);
        }
    },

    async completeSession(id: string, finalResult: AgentWorkflowResult, error?: Error) {
        if (!id) return;
        try {
            const db = await getDb();
            const status: AuditSessionStatus = error ? "FAILED" : "COMPLETED";

            const { timeline, eventStream, outputs } = finalResult || {};

            const updateDoc: any = {
                status,
                endedAt: new Date(),
                lastUpdated: new Date(),
                ...(error ? { error: error.message } : {})
            };

            // Hoist fields if available
            if (timeline) updateDoc.timeline = timeline;
            if (eventStream) updateDoc.eventStream = eventStream;
            if (outputs) updateDoc.outputs = outputs;

            // Also store the full result in workflowResult for completeness if needed, 
            // but hoisting is preferred for frontend access.
            if (finalResult) updateDoc.workflowResult = finalResult;

            await db.collection(COLLECTION_NAME).updateOne(
                { _id: new ObjectId(id) },
                { $set: updateDoc }
            );
        } catch (dbError) {
            console.error(`Failed to complete session ${id}:`, dbError);
        }
    }
};
