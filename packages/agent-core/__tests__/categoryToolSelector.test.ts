import { describe, it, expect } from "vitest";
import { categoryToolSelector } from "@kletron/agent-core/categoryToolSelector";
import { allMcpTools } from "@kletron/agent-core/tools/mcpTools";

describe("categoryToolSelector", () => {
    it("only references tools that actually exist in allMcpTools", () => {
        const realNames = new Set(
            allMcpTools.map((t: any) => String(t?.name ?? ""))
        );

        // Pull every tool the selector knows about across every category by
        // round-tripping through the public API for one representative
        // category and the internal getAllMcpTools() helper via reflection.
        const internal = (categoryToolSelector as any).getAllMcpTools.call(
            categoryToolSelector
        ) as Array<{ name: string }>;

        const aspirational = internal
            .map((t) => t.name)
            .filter((name) => !realNames.has(name));

        expect(
            aspirational,
            `categoryToolSelector references unknown tools: ${aspirational.join(", ")}. ` +
                `Either add the tool to allMcpTools or remove it from categoryToolSelector.`
        ).toEqual([]);
    });
});
