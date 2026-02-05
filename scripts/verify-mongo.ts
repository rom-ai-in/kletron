
import { auditService } from "@numezis/server/services/auditService";
import * as db from "@numezis/server/lib/db";
import { ObjectId } from "mongodb";

async function runVerification() {
    console.log("🔍 Starting MongoDB Integration Verification...");

    const testPrompt = "Test Audit Run " + new Date().toISOString();

    // 1. Test Create
    console.log("👉 Testing createSession...");
    const sessionId = await auditService.createSession(testPrompt);

    if (!sessionId) {
        console.error("❌ Failed to create session (returned empty ID). Check DB connection.");
        process.exit(1);
    }
    console.log(`✅ Session created with ID: ${sessionId}`);

    // 2. Test Update
    console.log("👉 Testing updateSession...");
    await auditService.updateSession(sessionId, {
        timeline: [{ id: "event-1", status: "success", summary: "Test Event", label: "Test" }] as any
    });
    console.log("✅ Session updated.");

    // 3. Test Complete
    console.log("👉 Testing completeSession...");
    await auditService.completeSession(sessionId, {
        conclusion: "Test Completed Successfully"
    } as any);
    console.log("✅ Session completed.");

    // 4. Verify Data in DB
    console.log("👉 Verifying data in MongoDB...");
    const database = await db.getDb();
    const doc = await database.collection("audit_sessions").findOne({ _id: new ObjectId(sessionId) });

    if (!doc) {
        console.error("❌ Document not found in DB!");
        process.exit(1);
    }

    if (doc.status !== "COMPLETED") {
        console.error(`❌ Unexpected status: ${doc.status} (expected COMPLETED)`);
        process.exit(1);
    }

    if (doc.prompt !== testPrompt) {
        console.error(`❌ Prompt mismatch: ${doc.prompt}`);
        process.exit(1);
    }

    if (doc.workflowResult?.conclusion !== "Test Completed Successfully") {
        console.error(`❌ Result mismatch.`);
        process.exit(1);
    }

    console.log("✅ All checks passed! Document verification successful.");
    console.log("📄 Document snapshot:", JSON.stringify(doc, null, 2));

    const closeFn = (db as any).closeDb ?? (db as any).closeMongoConnection;
    if (closeFn) {
        await closeFn();
    }
    process.exit(0);
}

runVerification().catch(err => {
    console.error("❌ Verification failed with error:", err);
    process.exit(1);
});
