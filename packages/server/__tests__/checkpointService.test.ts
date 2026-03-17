/**
 * Unit tests for checkpoint service pure functions.
 *
 * Tests exercise logic that doesn't require MongoDB:
 *  - buildThreadConfig
 *  - computeGraphHash
 *
 * Uses Node.js built-in test runner (npx tsx --test) for zero-dependency execution.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
    buildThreadConfig,
    computeGraphHash,
} from "@kletron/server/services/checkpointService";

// ─── buildThreadConfig ──────────────────────────────────────────────────────

describe("buildThreadConfig", () => {
    it("returns correct configurable shape with thread_id", () => {
        const config = buildThreadConfig("run123:nodeA");
        assert.deepStrictEqual(config, {
            configurable: {
                thread_id: "run123:nodeA",
                checkpoint_ns: "",
            },
        });
    });

    it("accepts a custom checkpoint namespace", () => {
        const config = buildThreadConfig("run123:nodeA", "my-ns");
        assert.equal(config.configurable.checkpoint_ns, "my-ns");
    });

    it("defaults checkpoint_ns to empty string", () => {
        const config = buildThreadConfig("tid");
        assert.equal(config.configurable.checkpoint_ns, "");
    });
});

// ─── computeGraphHash ───────────────────────────────────────────────────────

describe("computeGraphHash", () => {
    const nodes = [
        { id: "plan", kind: "react" as const },
        { id: "execute", kind: "react" as const },
    ];
    const edges = [
        { source: "plan", target: "execute" },
    ];

    it("returns an 8-char hex string", () => {
        const hash = computeGraphHash(nodes, edges);
        assert.match(hash, /^[0-9a-f]{8}$/);
    });

    it("produces the same hash for identical definitions", () => {
        const h1 = computeGraphHash(nodes, edges);
        const h2 = computeGraphHash([...nodes], [...edges]);
        assert.equal(h1, h2);
    });

    it("is order-independent for nodes", () => {
        const reversed = [...nodes].reverse();
        assert.equal(
            computeGraphHash(reversed, edges),
            computeGraphHash(nodes, edges)
        );
    });

    it("is order-independent for edges", () => {
        const multiEdges = [
            { source: "plan", target: "execute" },
            { source: "execute", target: "review" },
        ];
        const reversed = [...multiEdges].reverse();
        assert.equal(
            computeGraphHash(nodes, reversed),
            computeGraphHash(nodes, multiEdges)
        );
    });

    it("changes when a node is added", () => {
        const extraNode = [...nodes, { id: "review", kind: "react" as const }];
        assert.notEqual(
            computeGraphHash(extraNode, edges),
            computeGraphHash(nodes, edges)
        );
    });

    it("changes when an edge is added", () => {
        const extraEdge = [...edges, { source: "execute", target: "review" }];
        assert.notEqual(
            computeGraphHash(nodes, extraEdge),
            computeGraphHash(nodes, edges)
        );
    });

    it("changes when a node kind changes", () => {
        const modified = [
            { id: "plan", kind: "router" as const },
            { id: "execute", kind: "react" as const },
        ];
        assert.notEqual(
            computeGraphHash(modified, edges),
            computeGraphHash(nodes, edges)
        );
    });

    it("handles empty graph definition", () => {
        const hash = computeGraphHash([], []);
        assert.match(hash, /^[0-9a-f]{8}$/);
    });

    it("considers edge conditions", () => {
        const withCondition = [{ source: "plan", target: "execute", condition: "state.ok" }];
        const without = [{ source: "plan", target: "execute" }];
        assert.notEqual(
            computeGraphHash(nodes, withCondition),
            computeGraphHash(nodes, without)
        );
    });
});
