import { describe, it, expect } from "vitest";
import {
    connectorBindingsBulkSchema,
    connectorWorkspaceBindingsBulkSchema,
} from "../src/connectors/accountBindings";

describe("connectorBindingsBulkSchema", () => {
    it("accepts a bulk binding payload", () => {
        const parsed = connectorBindingsBulkSchema.parse({
            bindings: [
                { kind: "mcp_server", refId: "507f1f77bcf86cd799439011", enabled: true },
                { kind: "integration", refId: "507f191e810c19729de860ea", enabled: false },
            ],
        });
        expect(parsed.bindings).toHaveLength(2);
    });

    it("rejects empty refId", () => {
        expect(() =>
            connectorBindingsBulkSchema.parse({
                bindings: [{ kind: "mcp_server", refId: "", enabled: true }],
            })
        ).toThrow();
    });
});

describe("connectorWorkspaceBindingsBulkSchema", () => {
    it("accepts workspace toggles", () => {
        const parsed = connectorWorkspaceBindingsBulkSchema.parse({
            workspaces: [
                { workspaceId: "507f1f77bcf86cd799439011", enabled: true },
                { workspaceId: "507f191e810c19729de860ea", enabled: false },
            ],
        });
        expect(parsed.workspaces).toHaveLength(2);
    });

    it("rejects empty workspaceId", () => {
        expect(() =>
            connectorWorkspaceBindingsBulkSchema.parse({
                workspaces: [{ workspaceId: "", enabled: true }],
            })
        ).toThrow();
    });
});
