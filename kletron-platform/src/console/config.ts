import type {
  LockedAgentConfig,
  PolicyDocument,
  StopState,
} from "../shared/types.js";

export function buildLockedConfig(input: {
  policy: PolicyDocument;
  stops: StopState;
  employeeId: string;
  gatewayUrl: string;
  profile: string;
  litellmBaseUrl: string;
  defaultModel: string;
  providerStage: "beta" | "ga";
}): LockedAgentConfig {
  const enabledConnectors = input.policy.connectors.filter((c) => c.enabled);
  const resourcesByConnector = new Map<string, Set<string>>();
  for (const g of input.policy.grants) {
    const set = resourcesByConnector.get(g.connector) ?? new Set();
    set.add(g.resource);
    resourcesByConnector.set(g.connector, set);
  }

  return {
    clientId: input.policy.clientId,
    profile: input.profile,
    gatewayUrl: input.gatewayUrl,
    models: {
      provider: "litellm-everyware",
      providerStage: input.providerStage,
      baseUrl: input.litellmBaseUrl,
      defaultModel: input.defaultModel,
    },
    locks: {
      yoloMode: false,
      telemetry: false,
      autoUpdate: false,
      installRemotePlugins: false,
      directConnectorAccess: false,
    },
    stops: {
      global: input.stops.global,
      client: input.stops.client,
      employee: Boolean(input.stops.employees[input.employeeId]),
    },
    connectors: enabledConnectors.map((c) => ({
      id: c.connector,
      enabled: true,
      resources: [...(resourcesByConnector.get(c.connector) ?? [])] as LockedAgentConfig["connectors"][0]["resources"],
    })),
    servedAt: new Date().toISOString(),
  };
}
