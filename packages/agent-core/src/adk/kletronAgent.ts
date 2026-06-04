/**
 * Kletron ADK agent — exposes one Kletron graph node (the Simple ReAct
 * agent that powers most workspace chats) through Google's Agent Development
 * Kit, so the *same* logic can be called from:
 *
 *   1. The Kletron web UI (via `simpleReactNode` in `simpleReactGraph.ts`)
 *   2. The ADK CLI / runtime (`adk run`)
 *   3. Any A2A (Agent-to-Agent) client, via `toA2a()` below
 *
 * Tools come from a Kletron MCP server over Streamable HTTP — the same server
 * the web app talks to. We don't fork the tool surface; we share it.
 *
 * Model: Gemini via Vertex AI when GOOGLE_CLOUD_PROJECT + GOOGLE_CLOUD_LOCATION
 * are set, otherwise direct Gemini API.
 */

import { LlmAgent, Gemini, MCPToolset, type MCPConnectionParams } from "@google/adk";

export interface BuildKletronAdkAgentOptions {
    /** Display name for the agent. Shown in ADK UIs and A2A cards. */
    name?: string;
    /** One-line description. */
    description?: string;
    /** Model id, e.g. `gemini-2.5-pro` or `gemini-2.5-flash`. */
    model?: string;
    /** When true, use Vertex AI. Falls back to env GOOGLE_CLOUD_PROJECT presence. */
    useVertex?: boolean;
    /** GCP project id (Vertex). Defaults to env GOOGLE_CLOUD_PROJECT. */
    project?: string;
    /** GCP location (Vertex). Defaults to env GOOGLE_CLOUD_LOCATION or us-central1. */
    location?: string;
    /** Direct Gemini API key. Defaults to env GEMINI_API_KEY / GOOGLE_GENAI_API_KEY. */
    apiKey?: string;
    /**
     * URL of the Kletron MCP server (Streamable HTTP). Defaults to env
     * MCP_HTTP_URL or `http://localhost:9000/mcp`.
     */
    mcpUrl?: string;
    /** System instruction. A reasonable Kletron default is used when omitted. */
    instruction?: string;
}

const DEFAULT_INSTRUCTION = `You are the Kletron Simple ReAct agent.
You have access to the user's workspace through MCP tools.
Plan tool calls explicitly, prefer read-only tools first, and stop as soon as
you can give a confident answer. Cite tool outputs when you used them.`;

export function buildKletronAdkAgent(options: BuildKletronAdkAgentOptions = {}): LlmAgent {
    const model = options.model ?? process.env.VERTEX_MODEL ?? process.env.GEMINI_MODEL ?? "gemini-2.5-pro";
    const project = options.project ?? process.env.GOOGLE_CLOUD_PROJECT;
    const location = options.location ?? process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1";
    const apiKey =
        options.apiKey ?? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENAI_API_KEY;
    const useVertex = options.useVertex ?? Boolean(project);

    if (useVertex && !project) {
        throw new Error(
            "Vertex AI mode requires a project. Pass `project` or set GOOGLE_CLOUD_PROJECT."
        );
    }
    if (!useVertex && !apiKey) {
        throw new Error(
            "Direct Gemini API mode requires an API key. Pass `apiKey` or set GEMINI_API_KEY."
        );
    }

    const llm = new Gemini({
        model,
        ...(useVertex
            ? { vertexai: true, project: project!, location }
            : { apiKey: apiKey! }),
    });

    const mcpUrl = options.mcpUrl ?? process.env.MCP_HTTP_URL ?? "http://localhost:9000/mcp";
    const mcpConnection: MCPConnectionParams = {
        type: "StreamableHTTPConnectionParams",
        url: mcpUrl,
    };
    const mcpToolset = new MCPToolset(mcpConnection);

    return new LlmAgent({
        name: options.name ?? "kletron_simple_react",
        description:
            options.description ??
            "Kletron Simple ReAct agent — workspace MCP tools over Gemini.",
        model: llm,
        instruction: options.instruction ?? DEFAULT_INSTRUCTION,
        tools: [mcpToolset],
    });
}

/** Default-exported agent factory so the ADK CLI can pick it up. */
export const kletronAdkAgent = buildKletronAdkAgent;
export default kletronAdkAgent;
