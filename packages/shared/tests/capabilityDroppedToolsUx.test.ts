import { describe, expect, it } from "vitest";
import {
  formatDroppedToolsListPhrase,
  humanizeCapabilityToolName,
} from "../src/capabilityDroppedToolsUx";

describe("capabilityDroppedToolsUx", () => {
  it("maps known tools to friendly labels", () => {
    expect(humanizeCapabilityToolName("web_search")).toBe("Web search");
    expect(humanizeCapabilityToolName("fetch_url")).toBe("Opening web pages");
  });

  it("title-cases unknown snake_case tools", () => {
    expect(humanizeCapabilityToolName("custom_tool")).toBe("Custom Tool");
  });

  it("joins phrases for sentences", () => {
    expect(formatDroppedToolsListPhrase(["web_search"])).toBe("Web search");
    expect(formatDroppedToolsListPhrase(["web_search", "fetch_url"])).toBe(
      "Web search and Opening web pages",
    );
    expect(formatDroppedToolsListPhrase(["a", "b", "c"])).toBe("A, B, and C");
  });
});
