import { describe, expect, it } from "vitest";

import { __codexExecutionServiceTestables } from "../src/services/codexExecutionService";

describe("codexExecutionService testables", () => {
  it("computes effective injection key with hosted bearer hash", () => {
    const base = "ws:abc:key";
    const hosted = __codexExecutionServiceTestables.computeEffectiveInjectionKey(base, true, "token-123");
    const hostedNoToken = __codexExecutionServiceTestables.computeEffectiveInjectionKey(base, true, undefined);
    const local = __codexExecutionServiceTestables.computeEffectiveInjectionKey(base, false, "token-123");

    expect(local).toBe(base);
    expect(hosted).toMatch(/^ws:abc:key:hostedBearer:[a-f0-9]{16}$/);
    expect(hostedNoToken).toBe(`${base}:hostedBearer:no-token`);
    expect(hosted).not.toBe(hostedNoToken);
  });

  it("detects legacy and modern approval request methods", () => {
    expect(__codexExecutionServiceTestables.isApprovalRequestMethod("item/commandExecution/requestApproval")).toBe(true);
    expect(__codexExecutionServiceTestables.isApprovalRequestMethod("item/fileChange/requestApproval")).toBe(true);
    expect(__codexExecutionServiceTestables.isApprovalRequestMethod("applyPatchApproval")).toBe(true);
    expect(__codexExecutionServiceTestables.isApprovalRequestMethod("execCommandApproval")).toBe(true);
    expect(__codexExecutionServiceTestables.isApprovalRequestMethod("item/tool/call")).toBe(false);
  });

  it("builds mcp elicitation form response with action=accept", () => {
    const out = __codexExecutionServiceTestables.buildMcpElicitationResult({
      mode: "form",
      requestedSchema: {
        type: "object",
        required: ["decision", "persist", "confirm"],
        properties: {
          decision: { type: "string", enum: ["accept", "decline"] },
          persist: { type: "string", enum: ["session", "always"] },
          confirm: { type: "boolean" },
        },
      },
      meta: {
        codex_approval_kind: "mcp_tool_call",
        persist: ["always", "session"],
      },
    });

    expect(out).toMatchObject({
      action: "accept",
      _meta: null,
      content: {
        decision: "accept",
        persist: "session",
        confirm: true,
      },
    });
  });

  it("builds mcp elicitation url response with action=decline", () => {
    const out = __codexExecutionServiceTestables.buildMcpElicitationResult({
      mode: "url",
      message: "open browser",
      url: "https://example.com",
      elicitationId: "eli_1",
    });

    expect(out).toEqual({
      action: "decline",
      content: null,
      _meta: null,
    });
  });

  it("auto-answers requestUserInput questions deterministically", () => {
    const out = __codexExecutionServiceTestables.buildToolRequestUserInputAutoResponse({
      questions: [
        {
          id: "choice_a",
          options: [
            { label: "First option", description: "recommended" },
            { label: "Second option", description: "other" },
          ],
        },
        {
          id: "choice_b",
          options: [],
        },
      ],
    });

    expect(out).toEqual({
      answers: {
        choice_a: { answers: ["First option"] },
        choice_b: { answers: ["No preference"] },
      },
    });
  });

  it("builds approval payloads for legacy approvals and permissions", () => {
    const legacyDecline = __codexExecutionServiceTestables.buildApprovalPayloadForMethodPure(
      "applyPatchApproval",
      {},
      "decline",
    );
    const legacySession = __codexExecutionServiceTestables.buildApprovalPayloadForMethodPure(
      "execCommandApproval",
      {},
      "acceptForSession",
    );
    const permissionsDecline = __codexExecutionServiceTestables.buildApprovalPayloadForMethodPure(
      "item/permissions/requestApproval",
      { permissions: { fileSystem: { write: ["/tmp"] }, network: { enabled: true } } },
      "decline",
    );
    const permissionsSession = __codexExecutionServiceTestables.buildApprovalPayloadForMethodPure(
      "item/permissions/requestApproval",
      { permissions: { fileSystem: { write: ["/tmp"] }, network: { enabled: true } } },
      "acceptForSession",
    );
    const commandDecline = __codexExecutionServiceTestables.buildApprovalPayloadForMethodPure(
      "item/commandExecution/requestApproval",
      {},
      "decline",
    );

    expect(legacyDecline).toEqual({ decision: "denied" });
    expect(legacySession).toEqual({ decision: "approved_for_session" });
    expect(permissionsDecline).toEqual({
      permissions: {
        fileSystem: { entries: [] },
        network: { enabled: false },
      },
      scope: "turn",
    });
    expect(permissionsSession).toEqual({
      permissions: { fileSystem: { write: ["/tmp"] }, network: { enabled: true } },
      scope: "session",
    });
    expect(commandDecline).toEqual({ decision: "decline" });
  });
});
