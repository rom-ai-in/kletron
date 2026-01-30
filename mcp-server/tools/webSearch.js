export const webSearch = {
  description: "Search the web via Tavily API (requires TAVILY_API_KEY).",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string" },
      maxResults: { type: "number" },
      searchDepth: { type: "string", description: "basic | advanced" },
      includeAnswer: { type: "boolean" },
      includeRawContent: { type: "boolean" },
      includeImages: { type: "boolean" },
      timeoutMs: { type: "number" },
    },
    required: ["query"],
  },
  async run({
    query,
    maxResults = 5,
    searchDepth = "basic",
    includeAnswer = false,
    includeRawContent = false,
    includeImages = false,
    timeoutMs = 15_000,
  } = {}) {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      throw new Error("Missing TAVILY_API_KEY.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        signal: controller.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          max_results: Math.max(1, Math.trunc(maxResults)),
          search_depth: searchDepth,
          include_answer: includeAnswer,
          include_raw_content: includeRawContent,
          include_images: includeImages,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const detail = json && typeof json === "object" ? JSON.stringify(json) : String(res.status);
        throw new Error(`Tavily error: ${detail}`);
      }

      return json;
    } catch (error) {
      if (controller.signal.aborted) throw new Error("Tavily request timed out.");
      throw new Error(error?.message ? String(error.message) : "Tavily request failed.");
    } finally {
      clearTimeout(timeout);
    }
  },
};

