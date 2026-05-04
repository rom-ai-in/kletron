import { describe, expect, it } from "vitest";

import {
    resolveExternalToolRoute,
    type ExternalConnectionRoutingView,
} from "../src/workspaceExternalRouting";

function mapFrom(
    entries: Array<[string, Array<[string, ExternalConnectionRoutingView]>]>
): Map<string, Map<string, ExternalConnectionRoutingView>> {
    const out = new Map<string, Map<string, ExternalConnectionRoutingView>>();
    for (const [ws, slugs] of entries) {
        out.set(ws, new Map(slugs));
    }
    return out;
}

describe("resolveExternalToolRoute", () => {
    const healthy = (tools: string[]): ExternalConnectionRoutingView => ({
        tools: tools.map((name) => ({ name })),
    });

    it("returns workspace + slug key when workspaceId is explicit and slug matches case-insensitively", () => {
        const data = mapFrom([["ws-a", [["hunter", healthy(["Discover"])]]]]);
        expect(resolveExternalToolRoute(data, "Hunter", "ws-a")).toEqual({
            workspaceId: "ws-a",
            slugKey: "hunter",
        });
    });

    it("returns null when explicit workspace has no map", () => {
        const data = mapFrom([["ws-a", [["hunter", healthy(["x"])]]]]);
        expect(resolveExternalToolRoute(data, "hunter", "ws-missing")).toBeNull();
    });

    it("returns null when explicit workspace lacks the slug", () => {
        const data = mapFrom([["ws-a", [["slack", healthy(["post"])]]]]);
        expect(resolveExternalToolRoute(data, "hunter", "ws-a")).toBeNull();
    });

    it("returns null when connector is in error state", () => {
        const data = mapFrom([
            ["ws-a", [["hunter", { tools: [{ name: "a" }], error: "connect failed" }]]],
        ]);
        expect(resolveExternalToolRoute(data, "hunter", "ws-a")).toBeNull();
    });

    it("without workspaceId resolves when exactly one workspace owns the slug", () => {
        const data = mapFrom([
            ["ws-1", [["hunter", healthy(["Discover"])]]],
            ["ws-2", [["slack", healthy(["x"])]]],
        ]);
        expect(resolveExternalToolRoute(data, "hunter")).toEqual({
            workspaceId: "ws-1",
            slugKey: "hunter",
        });
    });

    it("without workspaceId returns null when two workspaces have the same slug", () => {
        const data = mapFrom([
            ["ws-1", [["hunter", healthy(["a"])]]],
            ["ws-2", [["hunter", healthy(["b"])]]],
        ]);
        expect(resolveExternalToolRoute(data, "hunter")).toBeNull();
    });

    it("without workspaceId ignores workspaces where that slug is errored", () => {
        const data = mapFrom([
            ["ws-1", [["hunter", { tools: [], error: "bad" }]]],
            ["ws-2", [["hunter", healthy(["ok"])]]],
        ]);
        expect(resolveExternalToolRoute(data, "hunter")).toEqual({
            workspaceId: "ws-2",
            slugKey: "hunter",
        });
    });

    it("supports multiple distinct slugs per workspace for many MCP servers", () => {
        const data = mapFrom([
            [
                "ws-x",
                [
                    ["hunter", healthy(["Discover"])],
                    ["slack", healthy(["post_message"])],
                    ["linear", healthy(["create_issue"])],
                ],
            ],
        ]);
        expect(resolveExternalToolRoute(data, "linear", "ws-x")).toEqual({
            workspaceId: "ws-x",
            slugKey: "linear",
        });
    });
});
