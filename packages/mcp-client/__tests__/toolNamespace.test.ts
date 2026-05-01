import { describe, expect, it } from "vitest";
import {
    MCP_TOOL_NAMESPACE_SEP,
    namespacedExternalToolName,
    parseNamespacedToolName,
} from "../src/multiClient";

describe("MCP multi-server tool namespacing", () => {
    it("joins slug and tool with double underscore", () => {
        expect(namespacedExternalToolName("my-server", "grep")).toBe(
            `my-server${MCP_TOOL_NAMESPACE_SEP}grep`
        );
    });

    it("parses namespaced tools", () => {
        expect(parseNamespacedToolName(`slack${MCP_TOOL_NAMESPACE_SEP}post_message`)).toEqual({
            serverSlug: "slack",
            toolName: "post_message",
        });
    });

    it("treats plain names as bundled-server tools", () => {
        expect(parseNamespacedToolName("read_file")).toEqual({
            serverSlug: null,
            toolName: "read_file",
        });
    });

    it("does not split on a leading separator", () => {
        expect(parseNamespacedToolName("__weird")).toEqual({
            serverSlug: null,
            toolName: "__weird",
        });
    });
});
