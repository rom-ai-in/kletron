/**
 * Default payload for POST /api/agent-graphs — keep in sync with
 * apps/web/app/app/agent-graphs/page.tsx `defaultGraphPayload`.
 */
export function defaultAgentGraphPayload(): {
  graph: {
    name: string;
    description: string;
    nodes: Array<Record<string, unknown>>;
    edges: unknown[];
  };
} {
  return {
    graph: {
      name: "New Agent Graph",
      description: "All nodes are ReAct agents. Outputs must be strict JSON.",
      nodes: [
        {
          id: "node-1",
          label: "Node 1",
          react: {
            systemPrompt:
              "You are a helpful ReAct agent. Use tools as needed. Output strict JSON only.",
            userPromptTemplate: "Analyze this state and produce the next output.\n\n{{state}}",
            toolNames: ["list_files", "read_file", "search_code"],
            llmSelection: { provider: "azure" },
          },
          output: { schemaId: "generic_json" },
        },
      ],
      edges: [],
    },
  };
}
