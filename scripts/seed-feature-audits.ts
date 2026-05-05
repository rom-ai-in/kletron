/**
 * Canonical DB seed: graphs + automation preset catalog + stage reconciliation.
 * For workspace-scoped preset rows, set WORKSPACE_ID (Mongo ObjectId string).
 *
 * Run: npx tsx scripts/seed-feature-audits.ts
 *      WORKSPACE_ID=... npx tsx scripts/seed-feature-audits.ts
 */
import dotenv from "dotenv";
dotenv.config();

import { ObjectId } from "mongodb";
import { agentGraphService } from "@kletron/server/services/agentGraphService";
import { automationExecutor } from "@kletron/server/services/automationExecutor";
import { getDb, closeDb } from "@kletron/server/lib/db";

async function main() {
    const workspaceId = process.env.WORKSPACE_ID?.trim();

    console.log("📌 Canonical agent graphs…");
    const g = await agentGraphService.upsertCanonicalPresetGraphs();
    console.log(`   ${JSON.stringify(g)}`);

    console.log("🔧 Reconcile automation stages…");
    const r = await automationExecutor.reconcileAutomationStageGraphs();
    console.log(`   updated: ${r.updated}`);

    if (workspaceId) {
        console.log(`🌱 Preset automations (workspace ${workspaceId})…`);
        const result = await automationExecutor.ensureDefaultAutomations(workspaceId);
        console.log(`   created: ${result.created.length}`, result.created);
        console.log(`   skipped: ${result.skipped.length}`);
    } else {
        console.log("⏭  WORKSPACE_ID not set — skipped automation preset seed.");
    }

    const db = await getDb();
    const wid = workspaceId && ObjectId.isValid(workspaceId) ? new ObjectId(workspaceId) : null;
    const count = await db.collection("audit_chains").countDocuments(wid ? { workspaceId: wid } : {});
    console.log(`\n📊 audit_chains count${workspaceId ? " (this workspace)" : " (all)"}: ${count}`);

    await closeDb();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
