import { I18nProcessWorker } from "@numezis/server/services/i18nProcessWorker";

async function main() {
  const pollIntervalMs = Number(process.env.I18N_WORKER_POLL_INTERVAL_MS ?? "1000");
  const lockTtlMs = Number(process.env.I18N_WORKER_LOCK_TTL_MS ?? String(2 * 60 * 1000));
  const heartbeatIntervalMs = Number(process.env.I18N_WORKER_HEARTBEAT_MS ?? String(10 * 1000));
  const maxToolCallsPerChunk = Number(process.env.I18N_WORKER_MAX_TOOLCALLS ?? "25");
  const hardChunkTimeoutMs = Number(process.env.I18N_WORKER_CHUNK_TIMEOUT_MS ?? String(10 * 60 * 1000));

  const worker = new I18nProcessWorker({
    pollIntervalMs,
    lockTtlMs,
    heartbeatIntervalMs,
    maxToolCallsPerChunk,
    hardChunkTimeoutMs,
  });

  const stop = () => {
    worker.stop();
    process.exit(0);
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  console.log("[I18nWorker] Started.");
  await worker.start();
}

main().catch((err) => {
  console.error("[I18nWorker] Fatal error:", err);
  process.exit(1);
});
