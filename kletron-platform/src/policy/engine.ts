import type {
  Action,
  ConnectorId,
  DenialReason,
  PermissionGrant,
  PolicyDocument,
  Principal,
  ResourceId,
} from "../shared/types.js";

export interface PolicyDecision {
  allow: boolean;
  reason?: DenialReason;
  message: string;
  matchedGrant?: PermissionGrant;
}

/**
 * Authorization: group × connector × resource × action.
 * Default deny when no grant matches.
 */
export class PolicyEngine {
  constructor(private policy: PolicyDocument) {}

  getPolicy(): PolicyDocument {
    return this.policy;
  }

  replacePolicy(policy: PolicyDocument): void {
    this.policy = policy;
  }

  isConnectorEnabled(connector: ConnectorId): boolean {
    const row = this.policy.connectors.find((c) => c.connector === connector);
    return row?.enabled === true;
  }

  requiresWriteApproval(connector: ConnectorId, resource: ResourceId): boolean {
    return this.policy.writeApprovalRequired.some(
      (r) => r.connector === connector && r.resource === resource,
    );
  }

  evaluate(
    principal: Principal,
    connector: ConnectorId,
    resource: ResourceId,
    action: Action,
  ): PolicyDecision {
    if (!this.isConnectorEnabled(connector)) {
      return {
        allow: false,
        reason: "connector_disabled",
        message: `Connector ${connector} is disabled (reactivated-tool / disabled connector still denied).`,
      };
    }

    const grants = this.policy.grants.filter(
      (g) =>
        principal.groups.includes(g.group) &&
        g.connector === connector &&
        g.resource === resource &&
        g.actions.includes(action),
    );

    if (grants.length === 0) {
      return {
        allow: false,
        reason: "default_deny",
        message: `Default deny: no grant for groups=[${principal.groups.join(",")}] ${connector}/${resource}/${action}`,
      };
    }

    return {
      allow: true,
      message: "allowed",
      matchedGrant: grants[0],
    };
  }

  /**
   * Agent-visible instruction text must never elevate rights.
   * Even if the text asks to "ignore policy", evaluation ignores it.
   */
  evaluateIgnoringInstruction(
    principal: Principal,
    connector: ConnectorId,
    resource: ResourceId,
    action: Action,
    _agentInstruction?: string,
  ): PolicyDecision {
    void _agentInstruction;
    return this.evaluate(principal, connector, resource, action);
  }
}
