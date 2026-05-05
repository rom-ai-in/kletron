/**
 * Hard-delete one credentials user (users collection) and dependent rows.
 * Usage: npx tsx scripts/purge-user-by-email.ts user@example.com
 *
 * Loads env from repo root `.env` (MONGODB_URI, optional MONGODB_USER/PASS, MONGODB_DB).
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function deleteCheckpointsForRun(db: ReturnType<MongoClient["db"]>, runId: string): Promise<number> {
    const prefix = `${runId}:`;
    const rx = new RegExp(`^${escapeRegex(prefix)}`);
    let n = 0;
    for (const colName of ["checkpoints", "checkpoint_writes"]) {
        try {
            const r = await db.collection(colName).deleteMany({ thread_id: { $regex: rx } });
            n += r.deletedCount ?? 0;
        } catch {
            /* collection may not exist */
        }
    }
    try {
        await db.collection("checkpoints").deleteMany({ thread_id: runId });
        await db.collection("checkpoint_writes").deleteMany({ thread_id: runId });
    } catch {
        /* ignore */
    }
    return n;
}

async function main() {
    const emailRaw = process.argv[2]?.trim().toLowerCase();
    if (!emailRaw) {
        console.error("Usage: npx tsx scripts/purge-user-by-email.ts <email>");
        process.exit(1);
    }

    const uri = process.env.MONGODB_URI?.trim();
    if (!uri) {
        console.error("MONGODB_URI missing");
        process.exit(1);
    }

    const dbName = process.env.MONGODB_DB?.trim() || process.env.MONGODB_DB_NAME?.trim() || "kletron";

    const client = new MongoClient(uri, {
        serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
        auth:
            process.env.MONGODB_USER && process.env.MONGODB_PASS
                ? { username: process.env.MONGODB_USER, password: process.env.MONGODB_PASS }
                : undefined,
    });

    await client.connect();
    const db = client.db(dbName);

    try {
        const user = await db.collection("users").findOne({
            email: { $regex: new RegExp(`^${escapeRegex(emailRaw)}$`, "i") },
        });
        if (!user?._id) {
            console.log(`No user found for email: ${emailRaw}`);
            return;
        }

        const userId = user._id.toString();
        const userOid = user._id as ObjectId;
        console.log(`Resolved user id=${userId} email=${user.email}`);

        const workspaceDocs = await db
            .collection("workspaces")
            .find({ ownerId: userId })
            .project({ _id: 1, rootPath: 1 })
            .toArray();
        const wsOids = workspaceDocs.map((w) => w._id as ObjectId);
        const wsStrings = wsOids.map((id) => id.toString());
        const repoPaths = [
            ...new Set(
                workspaceDocs
                    .map((w) => (typeof w.rootPath === "string" ? w.rootPath.trim() : ""))
                    .filter(Boolean)
            ),
        ];
        console.log(`Workspaces owned: ${wsStrings.length}`);

        const runDocs = await db
            .collection("agent_graph_runs")
            .find({
                $or: [{ createdByUserId: userId }, { workspaceId: { $in: wsOids } }],
            })
            .project({ _id: 1 })
            .toArray();
        const runIds = runDocs.map((r) => (r._id as ObjectId).toString());
        console.log(`Agent runs to remove: ${runIds.length}`);

        let ck = 0;
        for (const rid of runIds) {
            ck += await deleteCheckpointsForRun(db, rid);
        }
        if (ck) console.log(`Checkpoint docs deleted (approx): ${ck}`);

        const log = async (label: string, p: Promise<{ deletedCount?: number }>) => {
            const r = await p;
            const c = r.deletedCount ?? 0;
            if (c) console.log(`  ${label}: ${c}`);
        };

        await log(
            "agent_graph_runs",
            db.collection("agent_graph_runs").deleteMany({
                $or: [{ createdByUserId: userId }, { workspaceId: { $in: wsOids } }],
            })
        );

        const runObjIds = runIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
        if (runObjIds.length) {
            await log(
                "token_usage_logs",
                db.collection("token_usage_logs").deleteMany({ runId: { $in: runObjIds } })
            );
        }

        await log("agent_audit (by userId)", db.collection("agent_audit").deleteMany({ userId }));
        if (wsOids.length) {
            await log(
                "agent_audit (by workspaceId)",
                db.collection("agent_audit").deleteMany({ workspaceId: { $in: wsOids } })
            );
        }

        if (wsOids.length) {
            await log("audit_chains", db.collection("audit_chains").deleteMany({ workspaceId: { $in: wsOids } }));
        }

        for (const wid of wsStrings) {
            await log(
                `workspace_integrations (${wid.slice(-6)})`,
                db.collection("workspace_integrations").deleteMany({ workspaceId: wid })
            );
            await log(
                `workspace_mcp_servers (${wid.slice(-6)})`,
                db.collection("workspace_mcp_servers").deleteMany({ workspaceId: wid })
            );
            await log(
                `workspace_connector_bindings (${wid.slice(-6)})`,
                db.collection("workspace_connector_bindings").deleteMany({ workspaceId: wid })
            );
        }

        if (wsStrings.length) {
            await log(
                "workspace_plugins",
                db.collection("workspace_plugins").deleteMany({ workspaceId: { $in: wsStrings } })
            );
            await log(
                "workspace_skills",
                db.collection("workspace_skills").deleteMany({ workspaceId: { $in: wsStrings } })
            );
        }
        if (wsOids.length) {
            await log(
                "workspace_work_categories",
                db.collection("workspace_work_categories").deleteMany({ workspaceId: { $in: wsOids } })
            );
            await log(
                "workspace_channel_settings",
                db.collection("workspace_channel_settings").deleteMany({ workspaceId: { $in: wsOids } })
            );
            await log("audit_context_config", db.collection("audit_context_config").deleteMany({ workspaceId: { $in: wsStrings } }));
            await log("agent_memories", db.collection("agent_memories").deleteMany({ workspaceId: { $in: wsOids } }));
            await log(
                "index_status_snapshots",
                db.collection("index_status_snapshots").deleteMany({ workspaceId: { $in: wsStrings } })
            );
            await log(
                "vector_index_runs",
                db.collection("vector_index_runs").deleteMany({ workspaceId: { $in: wsStrings } })
            );
            await log(
                "channel_sessions",
                db.collection("channel_sessions").deleteMany({ workspaceId: { $in: wsOids } })
            );
            await log(
                "channel_user_links",
                db.collection("channel_user_links").deleteMany({ workspaceId: { $in: wsOids } })
            );
        }

        if (repoPaths.length) {
            await log(
                "code_vectors (by repoPath)",
                db.collection("code_vectors").deleteMany({ repoPath: { $in: repoPaths } })
            );
        }

        await log(
            "channel_user_links (by kletron user)",
            db.collection("channel_user_links").deleteMany({ kletronUserId: userOid })
        );
        await log(
            "channel_chat_context",
            db.collection("channel_chat_context").deleteMany({ kletronUserId: userOid })
        );

        await log("workspaces", db.collection("workspaces").deleteMany({ ownerId: userId }));
        await log("workspace_state", db.collection("workspace_state").deleteMany({ _id: userId }));

        await log(
            "category_state",
            db.collection("category_state").deleteMany({
                $or: [{ _id: userId }, { _id: new RegExp(`^${escapeRegex(userId)}::`) }],
            })
        );

        await log("user_profiles", db.collection("user_profiles").deleteMany({ userId }));
        await log("user_preferences", db.collection("user_preferences").deleteMany({ userId }));
        await log("api_tokens", db.collection("api_tokens").deleteMany({ userId }));
        await log("subscriptions", db.collection("subscriptions").deleteMany({ userId }));
        await log("skills (user-owned)", db.collection("skills").deleteMany({ ownerId: userId }));
        await log("account_integrations", db.collection("account_integrations").deleteMany({ ownerId: userId }));
        await log("account_mcp_servers", db.collection("account_mcp_servers").deleteMany({ ownerId: userId }));

        await log("ide_sessions", db.collection("ide_sessions").deleteMany({ "user.id": userId }));
        await log("ide_device_sessions", db.collection("ide_device_sessions").deleteMany({ "user.id": userId }));

        const mem = await db.collection("tenant_members").findOne<{ tenantId: ObjectId }>({ userId });
        const tenantId = mem?.tenantId;

        await log("tenant_group_members", db.collection("tenant_group_members").deleteMany({ userId }));
        await log("tenant_members", db.collection("tenant_members").deleteMany({ userId }));

        if (tenantId) {
            const remaining = await db.collection("tenant_members").countDocuments({ tenantId });
            if (remaining === 0) {
                console.log(`Tenant ${tenantId.toString()} has no members — removing org rows`);
                const groups = await db
                    .collection("tenant_groups")
                    .find({ tenantId })
                    .project({ _id: 1 })
                    .toArray();
                const gids = groups.map((g) => g._id as ObjectId);
                if (gids.length) {
                    await log(
                        "tenant_group_members (tenant)",
                        db.collection("tenant_group_members").deleteMany({ groupId: { $in: gids } })
                    );
                }
                await log("tenant_groups", db.collection("tenant_groups").deleteMany({ tenantId }));
                await log("tenant_companies", db.collection("tenant_companies").deleteMany({ tenantId }));
                await log("tenant_tool_approval", db.collection("tenant_tool_approval").deleteMany({ tenantId }));
                await log("tenants", db.collection("tenants").deleteOne({ _id: tenantId }));
            }
        }

        const ur = await db.collection("users").deleteOne({ _id: userOid });
        console.log(`users deleted: ${ur.deletedCount}`);
        console.log("Done.");
    } finally {
        await client.close();
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
