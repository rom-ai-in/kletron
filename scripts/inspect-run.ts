import dotenv from "dotenv";
dotenv.config();
import { getDb, closeDb } from "@kletron/server/lib/db";
import { ObjectId } from "mongodb";

async function main() {
    const db = await getDb();
    const run = await db.collection("audit_runs").findOne({ _id: new ObjectId("69b6d989a4e39e2dc025d5d7") });
    if (!run) { console.log("Run not found"); await closeDb(); return; }
    console.log("Status:", run.status);
    console.log("Error:", run.error || "none");
    console.log("Current Stage Index:", run.currentStageIndex);
    console.log("Stage Results count:", (run.stageResults || []).length);
    const results = run.stageResults || [];
    for (const r of results) {
        console.log("  Stage:", r.stageId, "- Status:", r.status);
        if (r.error) console.log("    Error:", typeof r.error === "string" ? r.error : JSON.stringify(r.error));
        if (r.output) console.log("    Output length:", r.output.length);
    }
    // Check all keys for error info
    const errorKeys = ["error", "errorDetails", "failedAtStage", "failReason", "lastError"];
    for (const key of errorKeys) {
        if ((run as any)[key] !== undefined) {
            console.log(key + ":", JSON.stringify((run as any)[key]));
        }
    }
    await closeDb();
}
main();
