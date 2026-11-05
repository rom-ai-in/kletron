export type Action = "read" | "write" | "delete";

export type ConnectorId = "bexio" | "m365";

export type ResourceId =
  | "contacts"
  | "invoices"
  | "mail"
  | "calendar"
  | "files";

export type DataClass = "C0" | "C1" | "C2" | "C3" | "C4";

export interface Principal {
  employeeId: string;
  displayName: string;
  groups: string[];
}

export interface PermissionGrant {
  /** Entra / local group name */
  group: string;
  connector: ConnectorId;
  resource: ResourceId;
  actions: Action[];
  /** Max data class allowed for this grant */
  maxClass?: DataClass;
}

export interface ConnectorToggle {
  connector: ConnectorId;
  enabled: boolean;
}

export interface PolicyDocument {
  version: string;
  clientId: string;
  grants: PermissionGrant[];
  connectors: ConnectorToggle[];
  /** Resources that always require human approval on write/delete */
  writeApprovalRequired: Array<{
    connector: ConnectorId;
    resource: ResourceId;
  }>;
}

export interface ToolCallRequest {
  callId: string;
  principal: Principal;
  connector: ConnectorId;
  resource: ResourceId;
  action: Action;
  payload: Record<string, unknown>;
  /** Client-supplied idempotency key (required for write/delete) */
  idempotencyKey?: string;
  /** For tests: optional injected instruction text the agent "saw" */
  agentInstruction?: string;
}

export type DenialReason =
  | "default_deny"
  | "connector_disabled"
  | "global_stop"
  | "client_stop"
  | "employee_stop"
  | "approval_required"
  | "approval_pending"
  | "approval_rejected"
  | "idempotency_conflict"
  | "direct_call_forbidden"
  | "network_denied"
  | "invalid_request";

export interface ToolCallSuccess {
  ok: true;
  callId: string;
  result: unknown;
  fromIdempotencyCache?: boolean;
  journalSeq: number;
}

export interface ToolCallDenial {
  ok: false;
  callId: string;
  reason: DenialReason;
  message: string;
  approvalId?: string;
  journalSeq: number;
}

export type ToolCallResponse = ToolCallSuccess | ToolCallDenial;

export interface JournalEvent {
  seq: number;
  ts: string;
  kind:
    | "tool_allow"
    | "tool_deny"
    | "approval_requested"
    | "approval_decided"
    | "stop_set"
    | "stop_cleared"
    | "config_served"
    | "direct_call_blocked"
    | "network_probe";
  actor?: string;
  connector?: ConnectorId;
  resource?: ResourceId;
  action?: Action;
  callId?: string;
  reason?: DenialReason | string;
  detail?: Record<string, unknown>;
}

export interface StopState {
  global: boolean;
  client: boolean;
  employees: Record<string, boolean>;
  updatedAt: string;
  updatedBy?: string;
}

export interface LockedAgentConfig {
  clientId: string;
  profile: string;
  gatewayUrl: string;
  models: {
    provider: string;
    providerStage: "beta" | "ga";
    baseUrl: string;
    defaultModel: string;
  };
  locks: {
    yoloMode: false;
    telemetry: false;
    autoUpdate: false;
    installRemotePlugins: false;
    directConnectorAccess: false;
  };
  stops: {
    global: boolean;
    client: boolean;
    employee: boolean;
  };
  connectors: Array<{
    id: ConnectorId;
    enabled: boolean;
    resources: ResourceId[];
  }>;
  servedAt: string;
}

export interface ApprovalRecord {
  id: string;
  callId: string;
  status: "pending" | "approved" | "rejected";
  principal: Principal;
  connector: ConnectorId;
  resource: ResourceId;
  action: Action;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
}
