/**
 * Kletron ADK + A2A entrypoint.
 *
 * Wraps `kletronAdkAgent` (the Simple ReAct node as an ADK LlmAgent) and
 * serves it on an Express app via Google ADK's `toA2a()` helper. This makes
 * the same Kletron agent reachable from:
 *
 *  - The ADK CLI / local SDK clients
 *  - Any A2A (Agent-to-Agent) protocol client
 *  - Other Cloud Run / Gemini Enterprise agents that want to delegate to it
 *
 * Designed to run on Cloud Run alongside `kletron-mcp` and `kletron-web`.
 * Auth: relies on the attached service account having "Vertex AI User".
 *
 * Required env:
 *   GOOGLE_CLOUD_PROJECT       — GCP project (for Vertex). Optional if
 *                                running with direct Gemini API + GEMINI_API_KEY.
 *   GOOGLE_CLOUD_LOCATION      — Default us-central1.
 *   VERTEX_MODEL               — Default gemini-2.5-pro.
 *   MCP_HTTP_URL               — Kletron MCP server URL. Default
 *                                http://localhost:9000/mcp.
 *   PORT                       — Default 8081 locally; Cloud Run injects its own.
 */

import express from "express";
import { toA2a } from "@google/adk";
import { buildKletronAdkAgent } from "@kletron/agent-core/adk/kletronAgent";

const PORT = Number.parseInt(process.env.PORT ?? "8081", 10);
const HOST = process.env.ADK_HOST ?? "0.0.0.0";

async function main() {
    const agent = buildKletronAdkAgent({
        name: "kletron_simple_react",
        description:
            "Kletron Simple ReAct agent on Gemini + Vertex AI, using workspace MCP tools.",
    });

    const app = await toA2a(agent, {
        host: HOST,
        port: PORT,
        protocol: process.env.ADK_PROTOCOL ?? "https",
        basePath: process.env.ADK_BASE_PATH ?? "a2a",
    });

    // Liveness for Cloud Run.
    app.get("/healthz", (_req: express.Request, res: express.Response) => {
        res.status(200).json({ ok: true });
    });

    app.listen(PORT, HOST, () => {
        console.info(
            `[kletron-adk] A2A agent listening on http://${HOST}:${PORT}/${process.env.ADK_BASE_PATH ?? "a2a"}`
        );
    });
}

main().catch((error) => {
    console.error("[kletron-adk] fatal startup error:", error);
    process.exit(1);
});
