import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import {
    classifyTool,
    getToolApprovalPolicy,
    normalizeRunSource,
    READONLY_TOOLS,
    WRITE_REPO_TOOLS,
} from "../src/services/toolApprovalPolicy";

const ORIGINAL_AUTO_APPROVE_SOURCES = process.env.AUTO_APPROVE_READONLY_SOURCES;
const ORIGINAL_NEVER_AUTO_APPROVE_TOOLS = process.env.NEVER_AUTO_APPROVE_TOOLS;

afterEach(() => {
    process.env.AUTO_APPROVE_READONLY_SOURCES = ORIGINAL_AUTO_APPROVE_SOURCES;
    process.env.NEVER_AUTO_APPROVE_TOOLS = ORIGINAL_NEVER_AUTO_APPROVE_TOOLS;
});

describe("toolApprovalPolicy source normalization", () => {
    it("normalizes known sources", () => {
        assert.equal(normalizeRunSource("agent"), "agent");
        assert.equal(normalizeRunSource("automation"), "automation");
    });

    it("falls back to unknown for legacy/empty sources", () => {
        assert.equal(normalizeRunSource(undefined), "unknown");
        assert.equal(normalizeRunSource(""), "unknown");
        assert.equal(normalizeRunSource("legacy"), "unknown");
    });
});

describe("toolApprovalPolicy tool classification", () => {
    it("classifies readonly tools", () => {
        assert.ok(READONLY_TOOLS.has("execute_bash"));
        assert.ok(READONLY_TOOLS.has("str_replace_editor"));
        assert.equal(classifyTool("read_file"), "readonly");
    });

    it("classifies write tools", () => {
        assert.ok(WRITE_REPO_TOOLS.has("write_file"));
        assert.equal(classifyTool("write_file"), "write_repo");
    });
});

describe("toolApprovalPolicy decision matrix", () => {
    it("auto-approves readonly tools for agent and automation", () => {
        process.env.AUTO_APPROVE_READONLY_SOURCES = "agent,automation";
        const agentPolicy = getToolApprovalPolicy({ source: "agent", toolName: "read_file" });
        const automationPolicy = getToolApprovalPolicy({ source: "automation", toolName: "execute_bash" });
        assert.equal(agentPolicy.decision, "auto_approve");
        assert.equal(automationPolicy.decision, "auto_approve");
    });

    it("requires manual approval for write_repo tools", () => {
        const repoWrite = getToolApprovalPolicy({ source: "agent", toolName: "write_file" });
        assert.equal(repoWrite.decision, "requires_approval");
    });

    it("uses conservative fallback for unknown source", () => {
        const readonlyPolicy = getToolApprovalPolicy({ source: "legacy", toolName: "read_file" });
        const unknownToolPolicy = getToolApprovalPolicy({ source: "legacy", toolName: "mystery_tool" });
        assert.equal(readonlyPolicy.decision, "requires_approval");
        assert.equal(unknownToolPolicy.decision, "requires_approval");
    });
});

describe("toolApprovalPolicy env overrides", () => {
    it("supports AUTO_APPROVE_READONLY_SOURCES override", () => {
        process.env.AUTO_APPROVE_READONLY_SOURCES = "agent";
        const agentPolicy = getToolApprovalPolicy({ source: "agent", toolName: "read_file" });
        const automationPolicy = getToolApprovalPolicy({ source: "automation", toolName: "read_file" });
        assert.equal(agentPolicy.decision, "auto_approve");
        assert.equal(automationPolicy.decision, "requires_approval");
    });

    it("supports NEVER_AUTO_APPROVE_TOOLS override", () => {
        process.env.NEVER_AUTO_APPROVE_TOOLS = "execute_bash,read_file";
        const executePolicy = getToolApprovalPolicy({ source: "agent", toolName: "execute_bash" });
        const readPolicy = getToolApprovalPolicy({ source: "agent", toolName: "read_file" });
        assert.equal(executePolicy.decision, "requires_approval");
        assert.equal(readPolicy.decision, "requires_approval");
    });
});
