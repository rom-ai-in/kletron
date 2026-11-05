import { randomUUID } from "node:crypto";
import type {
  Action,
  ApprovalRecord,
  ConnectorId,
  Principal,
  ResourceId,
} from "../shared/types.js";

export class ApprovalStore {
  private readonly byId = new Map<string, ApprovalRecord>();
  private readonly byCallId = new Map<string, string>();

  request(input: {
    callId: string;
    principal: Principal;
    connector: ConnectorId;
    resource: ResourceId;
    action: Action;
    payload: Record<string, unknown>;
    idempotencyKey?: string;
  }): ApprovalRecord {
    const existingId = this.byCallId.get(input.callId);
    if (existingId) {
      const existing = this.byId.get(existingId);
      if (existing) return existing;
    }
    const record: ApprovalRecord = {
      id: randomUUID(),
      callId: input.callId,
      status: "pending",
      principal: input.principal,
      connector: input.connector,
      resource: input.resource,
      action: input.action,
      payload: input.payload,
      idempotencyKey: input.idempotencyKey,
      createdAt: new Date().toISOString(),
    };
    this.byId.set(record.id, record);
    this.byCallId.set(input.callId, record.id);
    return record;
  }

  get(id: string): ApprovalRecord | undefined {
    return this.byId.get(id);
  }

  getByCallId(callId: string): ApprovalRecord | undefined {
    const id = this.byCallId.get(callId);
    return id ? this.byId.get(id) : undefined;
  }

  decide(
    id: string,
    decision: "approved" | "rejected",
    decidedBy: string,
  ): ApprovalRecord {
    const record = this.byId.get(id);
    if (!record) throw new Error(`Unknown approval ${id}`);
    if (record.status !== "pending") {
      throw new Error(`Approval ${id} already ${record.status}`);
    }
    record.status = decision;
    record.decidedAt = new Date().toISOString();
    record.decidedBy = decidedBy;
    return record;
  }

  listPending(): ApprovalRecord[] {
    return [...this.byId.values()].filter((r) => r.status === "pending");
  }
}
