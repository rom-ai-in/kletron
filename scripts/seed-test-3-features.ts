/**
 * Re-seed both automations with lmstudio provider.
 */
import dotenv from "dotenv";
dotenv.config();

import { automationExecutor } from "@numezis/server/services/automationExecutor";
import { AutomationConfigBuilder } from "@numezis/shared/automationConfigBuilder";
import { getDb, closeDb } from "@numezis/server/lib/db";

async function main() {
    const db = await getDb();

    // Clean all A43 automations
    const del = await db.collection("audit_chains").deleteMany({ name: /^A43/ });
    console.log("Cleaned:", del.deletedCount);

    // Re-seed full 127
    const fullResult = await automationExecutor.ensureDefaultAutomations();
    console.log("Full audit:", fullResult.created.length ? "Created" : "Skipped");

    // Create 3-feature test
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
    const all = await db.collection("audit_chains").find({ name: /^A43/ }).toArray();
    console.log("\nResult:");
    for (const a of all) {
        const stages = (a as any).stages || [];
        console.log(" ", a.name, "-", stages.length, "stages - provider:", stages[0]?.llmProvider);
    }

    await closeDb();
}
main();
