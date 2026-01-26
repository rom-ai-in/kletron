import "dotenv/config";
import { DriftAnalysisWorker } from "../src/services/driftAnalysisWorker";
import { getDb } from "../src/lib/db";
import { closeDb } from "../src/lib/db";

async function main() {
    console.log("[DriftWorker] Starting...");

    // Ensure DB connection
    await getDb();

    const worker = new DriftAnalysisWorker({
        pollIntervalMs: 2000,
        lockTtlMs: 30 * 60 * 1000,
        heartbeatIntervalMs: 15 * 1000
    });

    const shutdown = async () => {
        console.log("[DriftWorker] Stopping...");
        worker.stop();
        await closeDb();
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
