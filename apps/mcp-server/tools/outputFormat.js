export const outputFormat = {
  description:
    "Compatibility shim for agents that call `output_format`. It returns a normalized object so the model can delegate formatting without failing tool calls.",
  inputSchema: {
    type: "object",
    properties: {
      mode: { type: "string", description: "Optional mode label (Review/Fix/etc)." },
      evidence: { type: "object", description: "Arbitrary evidence payload." },
      verifications: { type: "object", description: "Arbitrary verification payload." },
      findings: { type: "object", description: "Arbitrary findings payload." },
      recommendations: { type: "object", description: "Arbitrary recommendations payload." },
      nextActions: { type: "object", description: "Arbitrary next actions payload." },
      text: { type: "string", description: "Optional pre-formatted text." },
    },
  },
  async run(payload = {}) {
    return {
      ok: true,
      ...payload,
    };
  },
};
