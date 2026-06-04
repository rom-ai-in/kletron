/**
 * Seed a real Mongo-backed Kletron account from the built-in demo account.
 *
 * This creates/updates a registered login for the target email, seeds profile
 * and preferences, creates a fresh organization, then transfers the demo
 * workspace ownership plus account-level connectors and history onto the new
 * account.
 *
 * Usage:
 *   TARGET_EMAIL=user@example.com TARGET_PASSWORD=change-me \
 *   MONGODB_URI="..." npx tsx scripts/seed-account.ts
 */

import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcrypt";
import { ObjectId } from "mongodb";
import { getDb, closeDb } from "@kletron/server/lib/db";
import * as organizationService from "@kletron/server/services/organizationService";
import * as userProfileService from "@kletron/server/services/userProfileService";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(ROOT, ".env.local") });
dotenv.config({ path: path.join(ROOT, ".env") });
dotenv.config();

const SOURCE_USER_ID = (process.env.SOURCE_USER_ID || "test-user-1").trim();
const SOURCE_EMAIL = (process.env.SOURCE_EMAIL || "demo@kletron.local").trim().toLowerCase();
const TARGET_EMAIL = (process.env.TARGET_EMAIL || "user@example.com").trim().toLowerCase();
const TARGET_FULL_NAME = (process.env.TARGET_FULL_NAME || "Demo User").trim();
const TARGET_PASSWORD = process.env.TARGET_PASSWORD || "change-me";
const DRY_RUN = process.env.DRY_RUN === "1";

function toObjectId(value: unknown): ObjectId | null {
    if (value instanceof ObjectId) return value;
    if (typeof value === "string" && ObjectId.isValid(value)) return new ObjectId(value);
    return null;
}

async function ensureTargetUserId(db: Awaited<ReturnType<typeof getDb>>): Promise<string> {
    const users = db.collection("users");
    const passwordHash = await bcrypt.hash(TARGET_PASSWORD, 12);
    const now = new Date();

    const existing = await users.findOne<{ _id: ObjectId; email?: string }>({
        email: TARGET_EMAIL,
    });

    if (existing?._id) {
        if (!DRY_RUN) {
            await users.updateOne(
                { _id: existing._id },
                {
                    $set: {
                        email: TARGET_EMAIL,
                        passwordHash,
                        password: passwordHash,
                        name: TARGET_FULL_NAME,
                        updatedAt: now,
                    },
                }
            );
        }
        return existing._id.toString();
    }

    if (DRY_RUN) {
        return new ObjectId().toString();
    }

    const result = await users.insertOne({
        _id: new ObjectId(),
        email: TARGET_EMAIL,
        passwordHash,
        password: passwordHash,
        name: TARGET_FULL_NAME,
        createdAt: now,
        updatedAt: now,
    });
    return result.insertedId.toString();
}

async function main() {
    if (!process.env.MONGODB_URI) {
        throw new Error("MONGODB_URI is required");
    }

    const db = await getDb();
    const now = new Date();

    const targetUserId = await ensureTargetUserId(db);

    if (!DRY_RUN) {
        await userProfileService.upsertProfile(targetUserId, TARGET_EMAIL, TARGET_FULL_NAME);
        await organizationService.ensureOrganizationForUser(targetUserId, {
            email: TARGET_EMAIL,
            fullName: TARGET_FULL_NAME,
        });
    }

    const sourceState = await db.collection("workspace_state").findOne<{ activeWorkspaceId?: ObjectId | string }>({
        _id: SOURCE_USER_ID,
    });
    const sourcePrefs = await db.collection("user_preferences").findOne<{
        selectedLlmProvider?: string | null;
        selectedGraphId?: string | null;
    }>({
        userId: SOURCE_USER_ID,
    });
    const sourceWorkspaceIds = await db
        .collection("workspaces")
        .find({ ownerId: SOURCE_USER_ID }, { projection: { _id: 1 } })
        .toArray();

    const fallbackWorkspaceId = toObjectId(sourceWorkspaceIds[0]?._id);
    const activeWorkspaceId = toObjectId(sourceState?.activeWorkspaceId) ?? fallbackWorkspaceId;

    if (!DRY_RUN) {
        await db.collection("workspace_state").updateOne(
            { _id: targetUserId },
            {
                $set: {
                    activeWorkspaceId,
                    updatedAt: now,
                },
                $setOnInsert: {
                    _id: targetUserId,
                },
            },
            { upsert: true }
        );

        await db.collection("user_preferences").updateOne(
            { userId: targetUserId },
            {
                $set: {
                    selectedLlmProvider: sourcePrefs?.selectedLlmProvider ?? null,
                    selectedGraphId: sourcePrefs?.selectedGraphId ?? null,
                    updatedAt: now,
                },
                $setOnInsert: {
                    userId: targetUserId,
                },
            },
            { upsert: true }
        );
    }

    const movePlan = [
        {
            collection: "workspaces",
            filter: { ownerId: SOURCE_USER_ID },
            update: { $set: { ownerId: targetUserId, updatedAt: now } },
        },
        {
            collection: "account_integrations",
            filter: { ownerId: SOURCE_USER_ID },
            update: { $set: { ownerId: targetUserId, updatedAt: now } },
        },
        {
            collection: "account_mcp_servers",
            filter: { ownerId: SOURCE_USER_ID },
            update: { $set: { ownerId: targetUserId, updatedAt: now } },
        },
        {
            collection: "agent_audit",
            filter: { userId: SOURCE_USER_ID },
            update: { $set: { userId: targetUserId } },
        },
        {
            collection: "agent_graph_runs",
            filter: { createdByUserId: SOURCE_USER_ID },
            update: { $set: { createdByUserId: targetUserId } },
        },
    ] as const;

    const results: Array<{ collection: string; matched: number; modified: number }> = [];
    if (!DRY_RUN) {
        for (const item of movePlan) {
            const r = await db.collection(item.collection).updateMany(item.filter as any, item.update as any);
            results.push({
                collection: item.collection,
                matched: r.matchedCount,
                modified: r.modifiedCount,
            });
        }
    }

    const summary = {
        ok: true,
        dryRun: DRY_RUN,
        source: {
            userId: SOURCE_USER_ID,
            email: SOURCE_EMAIL,
        },
        target: {
            userId: targetUserId,
            email: TARGET_EMAIL,
            fullName: TARGET_FULL_NAME,
        },
        activeWorkspaceId: activeWorkspaceId?.toString?.() ?? null,
        moved: results,
        login: {
            email: TARGET_EMAIL,
        },
    };

    console.log(JSON.stringify(summary, null, 2));
}

main()
    .catch((error) => {
        console.error("seed-account failed:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeDb().catch(() => undefined);
    });
