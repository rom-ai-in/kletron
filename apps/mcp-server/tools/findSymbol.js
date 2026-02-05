import { symbolsList } from "./symbolsList.js";

export const findSymbol = {
  description: "Find symbols by name substring (delegates to symbols_list).",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string" },
      query: { type: "string", description: "Substring to match." },
      exportedOnly: { type: "boolean" },
      maxResults: { type: "number" },
      globs: { type: "array", items: { type: "string" } },
    },
    required: ["query"],
  },
  async run(args = {}) {
    return await symbolsList.run(args);
  },
};

