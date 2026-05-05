/**
 * Re-seed both automations with lmstudio provider.
 */
import dotenv from "dotenv";
dotenv.config();

import { automationExecutor } from "@kletron/server/services/automationExecutor";
import { AutomationConfigBuilder } from "@kletron/shared/automationConfigBuilder";
import { getDb, closeDb } from "@kletron/server/lib/db";

async function main() {
    const db = await getDb();

    const del = await db.collection("audit_chains").deleteMany({ name: /^A43 Test/ });
    console.log("Cleaned A43 Test rows:", del.deletedCount);

    // Create 3-feature test (full preset catalog: scripts/seed-canonical-db.ts + WORKSPACE_ID)
    const testFeatures = ["foundation/contacts", "sales/invoices", "accounting/banking"];
    const config = AutomationConfigBuilder.buildFeatureAuditBatch(testFeatures, {
        name: "A43 Test — 3 Feature Audit"
    });
    const id = await automationExecutor.createAutomation({
        ...config,
        name: config.name!,
        description: config.description ?? "",
        stages: config.stages!,
        triggerType: "manual",
    } as any);
    console.log("Test automation created:", id);

    // Verify
    const all = await db.collection("audit_chains").find({ name: /^A43 Test/ }).toArray();
    console.log("\nResult:");
    for (const a of all) {
        const stages = (a as any).stages || [];
        console.log(" ", a.name, "-", stages.length, "stages - provider:", stages[0]?.llmProvider);
    }

    await closeDb();
}
void main();
