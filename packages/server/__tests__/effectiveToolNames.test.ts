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
});
