import { describe, it, expect } from "vitest";

import { nodeOutputSchemaRegistry } from "@kletron/shared/nodeOutputSchemas";

describe("nodeOutputSchemaRegistry", () => {
    it("contains the required schema IDs", () => {
        expect(Object.keys(nodeOutputSchemaRegistry)).toEqual(
            expect.arrayContaining([
                "generic_json",
                "phase1_output",
                "phase2_output",
                "phase3_output",
                "phase4_output",
                "phase5_output",
                "phase6_output",
            ])
        );
    });

    it("generic_json accepts object payloads", () => {
        const schema = nodeOutputSchemaRegistry.generic_json;
        expect(schema.parse({ hello: "world" })).toEqual({ hello: "world" });
    });
});

