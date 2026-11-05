import type { ApprovalStore } from "../approvals/store.js";
import { bexioExecute, m365Execute } from "../connectors/index.js";
import type { IdempotencyStore } from "../idempotency/store.js";
import type { AppendOnlyJournal } from "../journal/journal.js";
import type { PolicyEngine } from "../policy/engine.js";
import type { StopController } from "../policy/stops.js";
import type { OpenShellHarness } from "../openshell/harness.js";
import type {
  ToolCallDenial,
  ToolCallRequest,
  ToolCallResponse,
  ToolCallSuccess,
} from "../shared/types.js";

export interface GatewayDeps {
  policy: PolicyEngine;
  stops: StopController;
  approvals: ApprovalStore;
  idempotency: IdempotencyStore;
  journal: AppendOnlyJournal;
  openshell: OpenShellHarness;
  gatewayInternalToken: string;
  /** Fake connector hostnames used in direct-call / network tests */
  connectorHosts: { bexio: string; m365: string };
}

export class GatewayService {
  constructor(private readonly deps: GatewayDeps) {}

  /**
   * Canonical MCP-like tools/call entrypoint.
   * All authorization happens here — agent hooks are not trusted.
   */
  async toolsCall(req: ToolCallRequest): Promise<ToolCallResponse> {
    const stop = this.deps.stops.check(req.principal.employeeId);
    if (stop) {
      return this.deny(req, stop, `Stopped: ${stop}`);
    }

    // Instruction text never elevates rights (trapped-instruction proof)
    const decision = this.deps.policy.evaluateIgnoringInstruction(
      req.principal,
      req.connector,
      req.resource,
      req.action,
      req.agentInstruction,
    );

    if (!decision.allow) {
      return this.deny(
        req,
        decision.reason ?? "default_deny",
        decision.message,
      );
    }

    // Idempotency before approval: safe retries must not re-ask humans.
    if (req.action === "write" || req.action === "delete") {
      if (!req.idempotencyKey) {
        return this.deny(
          req,
          "invalid_request",
          "idempotencyKey required for write/delete",
        );
      }
      const looked = this.deps.idempotency.lookup(req.idempotencyKey, req.payload);
      if (looked?.kind === "hit") {
        const cached = looked.response;
        const event = this.deps.journal.append({
          kind: "tool_allow",
          actor: req.principal.employeeId,
          connector: req.connector,
          resource: req.resource,
          action: req.action,
          callId: req.callId,
          detail: { fromIdempotencyCache: true },
        });
        return { ...cached, callId: req.callId, journalSeq: event.seq, fromIdempotencyCache: true };
      }
      if (looked?.kind === "conflict") {
        return this.deny(
          req,
          "idempotency_conflict",
          "Idempotency key reused with different payload",
        );
      }
    }

    const needsApproval =
      (req.action === "write" || req.action === "delete") &&
      this.deps.policy.requiresWriteApproval(req.connector, req.resource);

    if (needsApproval) {
      const existing = this.deps.approvals.getByCallId(req.callId);
      if (!existing) {
        const approval = this.deps.approvals.request({
          callId: req.callId,
          principal: req.principal,
          connector: req.connector,
          resource: req.resource,
          action: req.action,
          payload: req.payload,
          idempotencyKey: req.idempotencyKey,
        });
        const event = this.deps.journal.append({
          kind: "approval_requested",
          actor: req.principal.employeeId,
          connector: req.connector,
          resource: req.resource,
          action: req.action,
          callId: req.callId,
          detail: { approvalId: approval.id },
        });
        return {
          ok: false,
          callId: req.callId,
          reason: "approval_required",
          message: "Human write validation required",
          approvalId: approval.id,
          journalSeq: event.seq,
        };
      }
      if (existing.status === "pending") {
        return this.deny(req, "approval_pending", "Approval still pending", existing.id);
      }
      if (existing.status === "rejected") {
        return this.deny(req, "approval_rejected", "Approval rejected", existing.id);
      }
      // approved → continue
    }

    try {
      const result = this.executeConnector(req);
      const event = this.deps.journal.append({
        kind: "tool_allow",
        actor: req.principal.employeeId,
        connector: req.connector,
        resource: req.resource,
        action: req.action,
        callId: req.callId,
      });
      const response: ToolCallSuccess = {
        ok: true,
        callId: req.callId,
        result,
        journalSeq: event.seq,
      };
      if (req.idempotencyKey && (req.action === "write" || req.action === "delete")) {
        this.deps.idempotency.put(req.idempotencyKey, req.payload, response);
      }
      return response;
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "direct_call_forbidden") {
        return this.deny(req, "direct_call_forbidden", (err as Error).message);
      }
      throw err;
    }
  }

  /**
   * Simulate an agent (or attacker) calling the connector host directly,
   * bypassing the gateway. OpenShell deny-by-default + connector token both refuse.
   */
  attemptDirectConnectorCall(
    connector: "bexio" | "m365",
    resource: ToolCallRequest["resource"],
    action: ToolCallRequest["action"],
    payload: Record<string, unknown>,
  ): ToolCallResponse {
    const host =
      connector === "bexio"
        ? this.deps.connectorHosts.bexio
        : this.deps.connectorHosts.m365;

    try {
      this.deps.openshell.assertAgentMayNotCall(host);
    } catch (err) {
      const event = this.deps.journal.append({
        kind: "direct_call_blocked",
        connector,
        resource,
        action,
        reason: "network_denied",
        detail: { host, error: (err as Error).message },
      });
      return {
        ok: false,
        callId: "direct",
        reason: "network_denied",
        message: (err as Error).message,
        journalSeq: event.seq,
      };
    }

    // If somehow network allowed, connector still requires gateway token
    try {
      if (connector === "bexio") {
        bexioExecute(resource, action, payload, {
          gatewayToken: "",
          expectedToken: this.deps.gatewayInternalToken,
        });
      } else {
        m365Execute(resource, action, payload, {
          gatewayToken: "",
          expectedToken: this.deps.gatewayInternalToken,
        });
      }
      return {
        ok: true,
        callId: "direct",
        result: null,
        journalSeq: this.deps.journal.currentSeq,
      };
    } catch (err) {
      const event = this.deps.journal.append({
        kind: "direct_call_blocked",
        connector,
        resource,
        action,
        reason: "direct_call_forbidden",
        detail: { error: (err as Error).message },
      });
      return {
        ok: false,
        callId: "direct",
        reason: "direct_call_forbidden",
        message: (err as Error).message,
        journalSeq: event.seq,
      };
    }
  }

  decideApproval(
    approvalId: string,
    decision: "approved" | "rejected",
    decidedBy: string,
  ) {
    const record = this.deps.approvals.decide(approvalId, decision, decidedBy);
    this.deps.journal.append({
      kind: "approval_decided",
      actor: decidedBy,
      connector: record.connector,
      resource: record.resource,
      action: record.action,
      callId: record.callId,
      detail: { approvalId, decision },
    });
    return record;
  }

  private executeConnector(req: ToolCallRequest): unknown {
    const ctx = {
      gatewayToken: this.deps.gatewayInternalToken,
      expectedToken: this.deps.gatewayInternalToken,
    };
    if (req.connector === "bexio") {
      return bexioExecute(req.resource, req.action, req.payload, ctx);
    }
    return m365Execute(req.resource, req.action, req.payload, ctx);
  }

  private deny(
    req: ToolCallRequest,
    reason: ToolCallDenial["reason"],
    message: string,
    approvalId?: string,
  ): ToolCallDenial {
    const event = this.deps.journal.append({
      kind: "tool_deny",
      actor: req.principal.employeeId,
      connector: req.connector,
      resource: req.resource,
      action: req.action,
      callId: req.callId,
      reason,
      detail: {
        message,
        agentInstructionPresent: Boolean(req.agentInstruction),
        approvalId,
      },
    });
    return {
      ok: false,
      callId: req.callId,
      reason,
      message,
      approvalId,
      journalSeq: event.seq,
    };
  }
}
