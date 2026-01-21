import { ObjectId } from "mongodb";
import { getDb } from "../lib/db";
import type { AgentWorkflowResult } from "../agentRunner";

export type AuditSessionStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export interface AuditSession {
    _id?: ObjectId;
    prompt: string;
    status: AuditSessionStatus;
    startedAt: Date;
    endedAt?: Date;
    workflowResult?: Partial<AgentWorkflowResult>;
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

    async updateSession(id: string, workflowResult: Partial<AgentWorkflowResult>) {
        if (!id) return;
        try {
            const db = await getDb();
            await db.collection(COLLECTION_NAME).updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        workflowResult,
                        status: "RUNNING",
                        lastUpdated: new Date()
                    }
                }
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

            await db.collection(COLLECTION_NAME).updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        workflowResult: finalResult,
                        status,
                        endedAt: new Date(),
                        lastUpdated: new Date(),
                        ...(error ? { error: error.message } : {})
                    }
                }
            );
        } catch (dbError) {
            console.error(`Failed to complete session ${id}:`, dbError);
        }
    }
};
