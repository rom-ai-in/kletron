import type { AppendOnlyJournal } from "../journal/journal.js";

export type OpenShellMode = "deny-by-default" | "allowlist";

export interface OpenShellConfig {
  mode: OpenShellMode;
  /** host:port allowlist when mode is allowlist or deny-by-default exceptions */
  allowlist: string[];
}

/**
 * Honest OpenShell harness for the local demo.
 * Real NVIDIA OpenShell is not wired here; this module documents and enforces
 * the intended network posture: deny by default, allow only gateway/console.
 */
export class OpenShellHarness {
  constructor(
    private readonly config: OpenShellConfig,
    private readonly journal?: AppendOnlyJournal,
  ) {}

  /**
   * Probe whether an outbound target would be allowed from an agent sandbox.
   */
  checkOutbound(targetHostPort: string): {
    allowed: boolean;
    reason: string;
  } {
    const normalized = targetHostPort.trim().toLowerCase();
    const allowed =
      this.config.mode === "allowlist" || this.config.mode === "deny-by-default"
        ? this.config.allowlist.map((a) => a.toLowerCase()).includes(normalized)
        : false;

    const reason = allowed
      ? `allowlist hit for ${normalized}`
      : `network denied by default for ${normalized}`;

    this.journal?.append({
      kind: "network_probe",
      reason: allowed ? "allow" : "network_denied",
      detail: { target: normalized, mode: this.config.mode },
    });

    return { allowed, reason };
  }

  /** Simulate agent trying to reach a connector host directly */
  assertAgentMayNotCall(targetHostPort: string): void {
    const result = this.checkOutbound(targetHostPort);
    if (!result.allowed) {
      const err = new Error(result.reason);
      (err as Error & { code: string }).code = "network_denied";
      throw err;
    }
  }

  describe(): Record<string, unknown> {
    return {
      implementation: "harness",
      honest: true,
      note: "Not NVIDIA OpenShell; enforces the same deny-by-default posture for local proofs.",
      mode: this.config.mode,
      allowlist: this.config.allowlist,
    };
  }
}
