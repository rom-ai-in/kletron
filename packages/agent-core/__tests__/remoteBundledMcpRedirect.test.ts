import { afterEach, describe, expect, it } from "vitest";
import { resolveRemoteBundledMcpToolName } from "../src/tools/mcpTools";

describe("resolveRemoteBundledMcpToolName", () => {
  afterEach(() => {
    delete process.env.KLETRON_REMOTE_FILE_MCP_SLUG;
  });

  it("returns null when env is unset", () => {
    expect(resolveRemoteBundledMcpToolName("list_files")).toBeNull();
  });

  it("namespaces listed bundled tools", () => {
    process.env.KLETRON_REMOTE_FILE_MCP_SLUG = "desktop";
    expect(resolveRemoteBundledMcpToolName("list_files")).toBe("desktop__list_files");
    expect(resolveRemoteBundledMcpToolName("read_file")).toBe("desktop__read_file");
  });

  it("does not double-namespace", () => {
    process.env.KLETRON_REMOTE_FILE_MCP_SLUG = "desktop";
    expect(resolveRemoteBundledMcpToolName("desktop__list_files")).toBeNull();
  });

  it("leaves web tools on bundled server", () => {
    process.env.KLETRON_REMOTE_FILE_MCP_SLUG = "desktop";
    expect(resolveRemoteBundledMcpToolName("web_search")).toBeNull();
    expect(resolveRemoteBundledMcpToolName("github_api")).toBeNull();
  });
});
