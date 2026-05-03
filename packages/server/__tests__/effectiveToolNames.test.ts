import { describe, it, expect } from "vitest";
import { effectiveToolNames } from "@kletron/server/services/effectiveToolNames";

describe("effectiveToolNames", () => {
    it("intersects requested tools with workspace capabilities", () => {
        const result = effectiveToolNames({
            nodeToolNames: ["read_file", "write_file"],
            skillToolNames: ["search_code"],
            adminToolNames: [],
            capabilityToolSet: new Set(["read_file", "search_code"]),
            externalNamespacedTools: [],
            alwaysOn: [],
        });
        expect(result.names).toEqual(["read_file", "search_code"]);
        expect(result.dropped).toEqual(["write_file"]);
        expect(result.externals).toEqual([]);
    });

    it("merges always-on tools regardless of capability set", () => {
        const result = effectiveToolNames({
            nodeToolNames: [],
            skillToolNames: [],
            adminToolNames: [],
            capabilityToolSet: new Set(),
            externalNamespacedTools: [],
            alwaysOn: ["write_todos"],
        });
        expect(result.names).toContain("write_todos");
    });

    it("adds external namespaced tools wholesale", () => {
        const result = effectiveToolNames({
            nodeToolNames: ["read_file"],
            skillToolNames: [],
            adminToolNames: [],
            capabilityToolSet: new Set(["read_file"]),
            externalNamespacedTools: ["acme__do_thing", "acme__other"],
            alwaysOn: [],
        });
        expect(result.names).toContain("acme__do_thing");
        expect(result.names).toContain("acme__other");
        expect(result.externals).toEqual(["acme__do_thing", "acme__other"]);
    });

    it("allows many MCP connectors at once (distinct slug__tool prefixes)", () => {
        const ext = ["hunter__Discover", "slack__post_message", "linear__create_issue"];
        const result = effectiveToolNames({
            nodeToolNames: [],
            skillToolNames: [],
            adminToolNames: [],
            capabilityToolSet: new Set(),
            externalNamespacedTools: ext,
            alwaysOn: [],
        });
        expect(result.externals).toEqual([...ext].sort());
        for (const n of ext) expect(result.names).toContain(n);
    });

    it("admin tools bypass the capability gate", () => {
        const result = effectiveToolNames({
            nodeToolNames: ["kletron_create_graph"],
            skillToolNames: [],
            adminToolNames: ["kletron_create_graph", "kletron_list_graphs"],
            capabilityToolSet: new Set(),
            externalNamespacedTools: [],
            alwaysOn: [],
        });
        expect(result.names).toContain("kletron_create_graph");
        expect(result.dropped).not.toContain("kletron_create_graph");
    });

    it("dedupes and sorts the final list", () => {
        const result = effectiveToolNames({
            nodeToolNames: ["b_tool", "a_tool", "b_tool"],
            skillToolNames: ["a_tool"],
            adminToolNames: [],
            capabilityToolSet: new Set(["a_tool", "b_tool"]),
            externalNamespacedTools: [],
            alwaysOn: [],
        });
        expect(result.names).toEqual(["a_tool", "b_tool"]);
    });

    it("uses default always-on when not specified", () => {
        const result = effectiveToolNames({
            nodeToolNames: [],
            skillToolNames: [],
            adminToolNames: [],
            capabilityToolSet: new Set(),
            externalNamespacedTools: [],
        });
        expect(result.names).toContain("write_todos");
    });

    it("keeps write_file when workspace caps include standard bundled toolkit", () => {
        const caps = new Set([
            "list_files",
            "read_file",
            "write_file",
            "str_replace_editor",
            "semantic_code_search",
        ]);
        const result = effectiveToolNames({
            nodeToolNames: ["write_file", "read_file", "unknown_tool"],
            skillToolNames: [],
            adminToolNames: [],
            capabilityToolSet: caps,
            externalNamespacedTools: [],
            alwaysOn: ["write_todos"],
        });
        expect(result.names).toContain("write_file");
        expect(result.names).toContain("read_file");
        expect(result.dropped).toContain("unknown_tool");
    });
});
