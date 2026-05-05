/**
 * Runs once per Node server process. Keeps Mongo agent_graphs in sync with code presets
 * (system prompts, tools, routing) after each deploy — idempotent replaceOne per canonical id.
 *
 * Disable locally if noisy: KLETRON_SKIP_CANONICAL_GRAPH_SYNC_ON_BOOT=true
 */
export async function register(): Promise<void> {
    if (process.env.NEXT_RUNTIME === "edge") return;

    const skip = process.env.KLETRON_SKIP_CANONICAL_GRAPH_SYNC_ON_BOOT;
    if (skip === "1" || skip === "true") return;

    try {
        const { agentGraphService } = await import("@kletron/server/services/agentGraphService");
        const result = await agentGraphService.upsertCanonicalPresetGraphs();
        console.info("[kletron] Canonical agent graphs synced at boot:", result);
    } catch (err) {
        console.warn(
            "[kletron] Canonical graph sync at boot failed (non-fatal):",
            (err as Error)?.message ?? err,
        );
    }
}
