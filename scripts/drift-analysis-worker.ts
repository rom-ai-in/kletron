import "dotenv/config";
import * as driftModule from "@numezis/server/services/driftAnalysisWorker";
import * as db from "@numezis/server/lib/db";

async function main() {
    console.log("[DriftWorker] Starting...");

    // Ensure DB connection
    await db.getDb();

    const DriftAnalysisWorker = (driftModule as any).DriftAnalysisWorker ?? (driftModule as any).default;
    if (!DriftAnalysisWorker) {
        throw new Error("DriftAnalysisWorker export not found.");
    }

    const worker = new DriftAnalysisWorker({
        pollIntervalMs: 2000,
        lockTtlMs: 30 * 60 * 1000,
        heartbeatIntervalMs: 15 * 1000
    });

    const shutdown = async () => {
        console.log("[DriftWorker] Stopping...");
        worker.stop();
        const closeFn = (db as any).closeDb ?? (db as any).closeMongoConnection;
        if (closeFn) {
            await closeFn();
        }
        process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    try {
        await worker.start();
    } catch (e) {
        console.error("[DriftWorker] Fatal error:", e);
        process.exit(1);
    }
}

main();
